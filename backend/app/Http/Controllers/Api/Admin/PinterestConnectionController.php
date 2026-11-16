<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\PinterestConnection;
use App\Models\PinterestPublishLog;
use App\Services\Pinterest\PinterestClient;
use App\Services\Pinterest\PinterestCredentials;
use App\Services\Pinterest\PinterestException;
use App\Services\Pinterest\PinterestPublishSettings;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

/**
 * Connecting the admin to the owner's Pinterest account, the boards to choose from, and the automatic-posting
 * switches. Access follows the Pinterest pin abilities (see EnforceAdminApiPermission).
 */
class PinterestConnectionController extends Controller
{
    /** How long the state value Pinterest sends back stays valid. */
    private const STATE_MINUTES = 15;

    public function __construct(
        private readonly PinterestClient $client,
        private readonly PinterestPublishSettings $settings,
        private readonly PinterestCredentials $credentials,
    ) {}

    /** Whether the account is connected, who it is, and the posting switches. Never returns a token. */
    public function show(): JsonResponse
    {
        $connection = PinterestConnection::current();

        return response()->json(['data' => [
            'configured' => $this->client->isConfigured(),
            'connected' => (bool) $connection?->isUsable(),
            'status' => $connection?->status ?? 'not_connected',
            'username' => $connection?->username,
            'last_error' => $connection?->last_error,
            'refresh_expires_at' => $connection?->refresh_expires_at?->toISOString(),
            'settings' => $this->settings->all(),
            // The app's details for the form. The secret is never sent back, only whether one is set.
            'credentials' => [
                'app_id' => $this->credentials->appId(),
                'redirect_uri' => $this->credentials->redirectUri(),
                'sandbox' => $this->credentials->sandbox(),
                'has_secret' => $this->credentials->hasSecret(),
            ],
            'recent_errors' => PinterestPublishLog::query()
                ->whereNotNull('error_code')
                ->orWhere('http_status', '>=', 400)
                ->latest('id')
                ->limit(5)
                ->get(['id', 'pinterest_pin_id', 'action', 'endpoint', 'http_status', 'error_code', 'message', 'created_at'])
                ->map(fn (PinterestPublishLog $log) => [
                    'id' => $log->id,
                    'pinterest_pin_id' => $log->pinterest_pin_id,
                    'action' => $log->action,
                    'endpoint' => $log->endpoint,
                    'http_status' => $log->http_status,
                    'error_code' => $log->error_code,
                    'message' => $log->message,
                    'created_at' => $log->created_at?->toISOString(),
                ])
                ->values(),
        ]]);
    }

    /** The Pinterest page to send the owner to. The state value proves the answer comes back to the same admin. */
    public function authorizeUrl(Request $request): JsonResponse
    {
        if (! $this->client->isConfigured()) {
            return response()->json(['message' => 'Pinterest is not set up on the server (app id, secret and redirect address).'], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        $state = Str::random(40);
        Cache::put($this->stateKey($request, $state), true, now()->addMinutes(self::STATE_MINUTES));

        return response()->json(['data' => ['url' => $this->client->authorizationUrl($state)]]);
    }

    /** Pinterest sends the owner back to the admin with a code; the admin page hands it here. */
    public function callback(Request $request): JsonResponse
    {
        $data = $request->validate([
            'code' => ['required', 'string', 'max:2048'],
            'state' => ['required', 'string', 'max:128'],
        ]);

        if (! Cache::pull($this->stateKey($request, $data['state']))) {
            return response()->json(['message' => 'This connection attempt expired or did not start here. Try connecting again.'], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        try {
            $connection = $this->client->connect($data['code']);
        } catch (PinterestException $e) {
            return response()->json(['message' => 'Pinterest refused the connection: '.$e->getMessage()], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        return response()->json(['data' => ['connected' => true, 'username' => $connection->username]]);
    }

    public function disconnect(): Response
    {
        $this->client->disconnect();

        return response()->noContent();
    }

    /** The owner's boards, for the pin form. */
    public function boards(): JsonResponse
    {
        try {
            return response()->json(['data' => $this->client->boards()]);
        } catch (PinterestException $e) {
            $status = $e->isAuthFailure() ? Response::HTTP_UNAUTHORIZED : Response::HTTP_BAD_GATEWAY;

            return response()->json(['message' => $e->getMessage()], $status);
        }
    }

    public function updateSettings(Request $request): JsonResponse
    {
        $data = $request->validate([
            'auto_publish' => ['sometimes', 'boolean'],
            'max_per_day' => ['sometimes', 'integer', 'min:1', 'max:10'],
            'min_gap_minutes' => ['sometimes', 'integer', 'min:30', 'max:1440'],
            'window_start' => ['sometimes', 'date_format:H:i'],
            'window_end' => ['sometimes', 'date_format:H:i', 'after:window_start'],
            'timezone' => ['sometimes', Rule::in(timezone_identifiers_list())],
        ]);

        return response()->json(['data' => $this->settings->update($data)]);
    }

    /**
     * Saves the Pinterest app's details. The secret is optional: left blank, the saved one stays. It is stored
     * encrypted and never returned.
     */
    public function updateCredentials(Request $request): JsonResponse
    {
        $data = $request->validate([
            'app_id' => ['required', 'string', 'regex:/^\d{4,32}$/'],
            'app_secret' => ['nullable', 'string', 'min:8', 'max:255'],
            'redirect_uri' => ['required', 'url', 'max:2048'],
            'sandbox' => ['required', 'boolean'],
        ], [
            'app_id.regex' => 'The app id is the number shown on the app in developers.pinterest.com.',
        ]);

        // A first save has nothing to fall back on, so the secret is required then.
        if (blank($data['app_secret'] ?? null) && ! $this->credentials->hasSecret()) {
            return response()->json([
                'message' => 'The app secret is required.',
                'errors' => ['app_secret' => ['Enter the app secret from developers.pinterest.com.']],
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        $this->credentials->update($data);

        return response()->json(['data' => [
            'app_id' => $this->credentials->appId(),
            'redirect_uri' => $this->credentials->redirectUri(),
            'sandbox' => $this->credentials->sandbox(),
            'has_secret' => $this->credentials->hasSecret(),
        ]]);
    }

    /** Tied to the signed-in user so one admin's attempt cannot be completed by another session. */
    private function stateKey(Request $request, string $state): string
    {
        return 'pinterest:oauth-state:'.$request->user()->getAuthIdentifier().':'.$state;
    }
}
