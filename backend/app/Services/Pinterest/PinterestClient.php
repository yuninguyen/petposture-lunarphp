<?php

namespace App\Services\Pinterest;

use App\Models\PinterestConnection;
use App\Models\PinterestPin;
use App\Models\PinterestPublishLog;
use App\Models\User;
use App\Notifications\PinterestConnectionNotification;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Str;

/**
 * The only place that talks to the Pinterest API v5. It keeps the one connection's tokens fresh, and writes a
 * log row for every call (endpoint and outcome, never a token).
 */
class PinterestClient
{
    private const TIMEOUT_SECONDS = 30;

    /** Refresh the access token when it has less than this left, so a call never starts with a dying token. */
    private const REFRESH_MARGIN_SECONDS = 120;

    public function __construct(private readonly PinterestCredentials $credentials) {}

    public function isConfigured(): bool
    {
        return $this->credentials->isComplete();
    }

    /** The Pinterest page where the owner is asked to let this app post pins. */
    public function authorizationUrl(string $state): string
    {
        return config('services.pinterest.oauth_url').'?'.http_build_query([
            'client_id' => $this->credentials->appId(),
            'redirect_uri' => $this->credentials->redirectUri(),
            'response_type' => 'code',
            'scope' => implode(',', config('services.pinterest.scopes')),
            'state' => $state,
        ]);
    }

    /** Trades the code Pinterest sent back for tokens and remembers who is connected (replacing any earlier connection). */
    public function connect(string $code): PinterestConnection
    {
        $tokens = $this->requestToken([
            'grant_type' => 'authorization_code',
            'code' => $code,
            'redirect_uri' => $this->credentials->redirectUri(),
        ], 'connect');

        $connection = new PinterestConnection;
        $this->applyTokens($connection, $tokens);
        $connection->status = PinterestConnection::STATUS_CONNECTED;
        $connection->last_error = null;
        $connection->expiry_warned_at = null;
        $connection->save();

        try {
            $account = $this->send($connection, 'get', '/user_account', null, 'account');
            $connection->fill([
                'pinterest_user_id' => $account['id'] ?? null,
                'username' => $account['username'] ?? null,
            ])->save();
        } catch (PinterestException) {
            // Connected all the same; the name is only for display and the failure is already logged.
        }

        PinterestConnection::query()->whereKeyNot($connection->id)->delete();

        return $connection;
    }

    /** Gets a new access token. A refusal means the owner must reconnect, so the connection is marked lost. */
    public function refresh(PinterestConnection $connection): PinterestConnection
    {
        try {
            $tokens = $this->requestToken([
                'grant_type' => 'refresh_token',
                'refresh_token' => $connection->refresh_token,
            ], 'refresh');
        } catch (PinterestException $e) {
            if ($e->isAuthFailure()) {
                $this->markLost($connection, $e->getMessage());
            }

            throw $e;
        }

        $this->applyTokens($connection, $tokens);
        $connection->last_refreshed_at = now();
        $connection->last_error = null;
        $connection->save();

        return $connection;
    }

    /** The owner's boards as [id, name], every page. */
    public function boards(): array
    {
        $connection = $this->requireConnection();
        $boards = [];
        $bookmark = null;

        do {
            $query = http_build_query(array_filter(['page_size' => 100, 'bookmark' => $bookmark]));
            $page = $this->send($connection, 'get', '/boards?'.$query, null, 'boards');

            foreach ($page['items'] ?? [] as $board) {
                $boards[] = ['id' => (string) $board['id'], 'name' => (string) ($board['name'] ?? '')];
            }

            $bookmark = $page['bookmark'] ?? null;
        } while ($bookmark);

        usort($boards, fn (array $a, array $b) => strcasecmp($a['name'], $b['name']));

        return $boards;
    }

    /** Creates a board on the connected account and returns it as [id, name]. Needs the boards:write permission. */
    public function createBoard(string $name): array
    {
        $created = $this->send($this->requireConnection(), 'post', '/boards', ['name' => $name], 'create_board');

        if (blank($created['id'] ?? null)) {
            throw new PinterestException('Pinterest answered without a board id.', 200);
        }

        return ['id' => (string) $created['id'], 'name' => (string) ($created['name'] ?? $name)];
    }

    /** Deletes a pin from the connected account on Pinterest. A pin that is already gone (404) counts as deleted. */
    public function deletePin(string $pinterestPinId): void
    {
        $this->deleteRemote('/pins/'.$pinterestPinId, 'delete_pin');
    }

    /** Deletes a board and, on Pinterest's side, every pin on it. A board that is already gone (404) counts as deleted. */
    public function deleteBoard(string $boardId): void
    {
        $this->deleteRemote('/boards/'.$boardId, 'delete_board');
    }

    private function deleteRemote(string $path, string $action): void
    {
        try {
            $this->send($this->requireConnection(), 'delete', $path, null, $action);
        } catch (PinterestException $e) {
            if ($e->httpStatus !== 404) {
                throw $e;
            }
        }
    }

    /**
     * Creates the pin and returns Pinterest's id for it. The image goes as base64 so it does not have to be
     * reachable from the internet. A timeout or 5xx throws with outcomeUnknown set: the pin may exist.
     */
    public function createPin(PinterestPin $pin, string $imageBytes, string $mime): string
    {
        $connection = $this->requireConnection();

        $created = $this->send($connection, 'post', '/pins', [
            'board_id' => $pin->pinterest_board_id,
            'title' => $pin->title,
            'description' => $pin->description,
            'link' => $pin->destination_url,
            'media_source' => [
                'source_type' => 'image_base64',
                'content_type' => $mime,
                'data' => base64_encode($imageBytes),
            ],
        ], 'create_pin', $pin->id);

        if (blank($created['id'] ?? null)) {
            throw new PinterestException('Pinterest answered without a pin id.', 200, null, true);
        }

        return (string) $created['id'];
    }

    /** Forgets the tokens. The pins and their history stay. */
    public function disconnect(): void
    {
        PinterestConnection::query()->delete();
    }

    /** Pauses everything until the owner reconnects, and tells the admin, once. */
    public function markLost(PinterestConnection $connection, string $reason): void
    {
        $wasUsable = $connection->isUsable();

        $connection->forceFill([
            'status' => PinterestConnection::STATUS_DISCONNECTED,
            'last_error' => Str::limit($reason, 500),
        ])->save();

        if ($wasUsable) {
            Notification::send(User::staffRecipients(), new PinterestConnectionNotification(PinterestConnectionNotification::LOST, Str::limit($reason, 120)));
        }
    }

    private function requireConnection(): PinterestConnection
    {
        $connection = PinterestConnection::current();

        if (! $connection || ! $connection->isUsable()) {
            throw new PinterestException('Pinterest is not connected.', 401, 'not_connected');
        }

        return $connection;
    }

    /**
     * One authenticated call. Refreshes first if the token is about to run out, and once more on a 401 (the token
     * can be revoked early); a second 401 means the connection is lost.
     */
    private function send(PinterestConnection $connection, string $method, string $path, ?array $body, string $action, ?int $pinId = null): array
    {
        if ($connection->access_expires_at && $connection->access_expires_at->lt(now()->addSeconds(self::REFRESH_MARGIN_SECONDS))) {
            $this->refresh($connection);
        }

        try {
            return $this->call($connection, $method, $path, $body, $action, $pinId);
        } catch (PinterestException $e) {
            if ($e->httpStatus !== 401) {
                throw $e;
            }
        }

        $this->refresh($connection);

        try {
            return $this->call($connection, $method, $path, $body, $action, $pinId);
        } catch (PinterestException $e) {
            if ($e->httpStatus === 401) {
                $this->markLost($connection, $e->getMessage());
            }

            throw $e;
        }
    }

    private function call(PinterestConnection $connection, string $method, string $path, ?array $body, string $action, ?int $pinId): array
    {
        $started = microtime(true);
        $endpoint = strtoupper($method).' '.Str::before($path, '?');

        try {
            $request = $this->http()->withToken($connection->access_token);
            $response = $method === 'get' ? $request->get($path) : $request->asJson()->{$method}($path, $body ?? []);
        } catch (ConnectionException $e) {
            $this->log($action, $endpoint, null, null, 'No answer from Pinterest: '.$e->getMessage(), $started, $pinId);

            throw new PinterestException('No answer from Pinterest.', null, 'connection', true);
        }

        return $this->handle($response, $action, $endpoint, $started, $pinId);
    }

    private function requestToken(array $form, string $action): array
    {
        $started = microtime(true);
        $endpoint = 'POST /oauth/token';

        try {
            $response = $this->http()
                ->withBasicAuth((string) $this->credentials->appId(), (string) $this->credentials->appSecret())
                ->asForm()
                ->post('/oauth/token', $form);
        } catch (ConnectionException $e) {
            $this->log($action, $endpoint, null, null, 'No answer from Pinterest: '.$e->getMessage(), $started);

            throw new PinterestException('No answer from Pinterest.', null, 'connection', true);
        }

        return $this->handle($response, $action, $endpoint, $started);
    }

    private function handle(Response $response, string $action, string $endpoint, float $started, ?int $pinId = null): array
    {
        $json = $response->json();
        $json = is_array($json) ? $json : [];

        if ($response->successful()) {
            $this->log($action, $endpoint, $response->status(), null, null, $started, $pinId);

            return $json;
        }

        $code = isset($json['error']) ? (string) $json['error'] : (isset($json['code']) ? (string) $json['code'] : null);
        $message = (string) ($json['message'] ?? $json['error_description'] ?? "Pinterest answered {$response->status()}.");

        $this->log($action, $endpoint, $response->status(), $code, $message, $started, $pinId);

        // 5xx: Pinterest may have acted before failing. 4xx: it refused, nothing was created.
        throw new PinterestException($message, $response->status(), $code, $response->serverError());
    }

    private function applyTokens(PinterestConnection $connection, array $tokens): void
    {
        $connection->access_token = (string) $tokens['access_token'];

        if (filled($tokens['refresh_token'] ?? null)) {
            $connection->refresh_token = (string) $tokens['refresh_token'];
        }

        $connection->access_expires_at = isset($tokens['expires_in']) ? now()->addSeconds((int) $tokens['expires_in']) : null;
        $connection->refresh_expires_at = isset($tokens['refresh_token_expires_in']) ? now()->addSeconds((int) $tokens['refresh_token_expires_in']) : $connection->refresh_expires_at;
        $connection->scopes = $tokens['scope'] ?? $connection->scopes;
    }

    private function http(): PendingRequest
    {
        return Http::baseUrl($this->credentials->apiBase())
            ->timeout(self::TIMEOUT_SECONDS)
            ->acceptJson();
    }

    private function log(string $action, string $endpoint, ?int $status, ?string $code, ?string $message, float $started, ?int $pinId = null): void
    {
        PinterestPublishLog::query()->create([
            'pinterest_pin_id' => $pinId,
            'action' => $action,
            'endpoint' => $endpoint,
            'http_status' => $status,
            'error_code' => $code ? Str::limit($code, 64, '') : null,
            'message' => $message ? Str::limit($message, 500) : null,
            'duration_ms' => (int) round((microtime(true) - $started) * 1000),
        ]);
    }
}
