<?php

namespace App\Services;

use App\Jobs\PurgeCloudflareCache;
use Carbon\CarbonImmutable;
use Illuminate\Database\Connection;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\Bus;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use InvalidArgumentException;
use PDO;
use RuntimeException;
use Throwable;

/** Independent post-commit journal, not an atomic content outbox. */
class StorefrontRefreshJournal
{
    public const CONNECTION = 'storefront_refresh_journal';
    private const BACKOFF = [30, 120, 300];
    private const STATUSES = ['enqueue_unavailable', 'eviction_failed', 'refresh_failed', 'lease_expired', 'not_configured', 'attempts_exhausted', 'success'];

    private function connection(): Connection
    {
        if (! array_key_exists(self::CONNECTION, DB::getConnections())) {
            // getConfig() is Laravel's resolved URL configuration. Apply the same
            // write override as ConnectionFactory, then remove all replica routes.
            $config = DB::connection()->getConfig();
            $write = $config['write'] ?? [];
            if (isset($write[0])) {
                $write = Arr::random($write);
            }
            $config = array_merge($config, $write);
            unset($config['read'], $config['write'], $config['sticky'], $config['url'], $config['name']);
            $config['options'][PDO::ATTR_PERSISTENT] = false;
            config(['database.connections.'.self::CONNECTION => $config]);
        }
        $connection = DB::connection(self::CONNECTION);
        if ($connection->transactionLevel() !== 0 || $connection->getPdo()->inTransaction()) {
            throw new RuntimeException('Journal connection must remain in autocommit mode.');
        }
        return $connection;
    }

    private function rows(): Builder
    {
        return $this->connection()->table('storefront_refresh_journal');
    }

    private function keys(array $keys): array
    {
        foreach ($keys as $key) {
            if (! is_string($key) || ! preg_match('/\A(?:setting:|public-api:site-media:v1:)[^\x00-\x20]{1,255}\z/D', $key)) {
                throw new InvalidArgumentException('Invalid journal cache-key snapshot.');
            }
        }
        return array_values(array_unique($keys));
    }

    public function record(array $keys, ?string $id = null): string
    {
        $keys = $this->keys($keys);
        $id ??= (string) Str::uuid();
        if (! Str::isUuid($id)) {
            throw new InvalidArgumentException('Invalid journal identifier.');
        }
        $existing = $this->find($id);
        if ($existing === null) {
            $now = CarbonImmutable::now('UTC');
            try {
                $this->rows()->insert([
                    'id' => $id, 'cache_keys' => json_encode($keys, JSON_THROW_ON_ERROR),
                    'state' => 'pending', 'recovery_attempts' => 0, 'initial_attempted' => false,
                    'next_attempt_at' => $now, 'next_dispatch_at' => $now,
                    'created_at' => $now, 'updated_at' => $now,
                ]);
                return $id;
            } catch (Throwable $error) {
                // A duplicate or uncertain acknowledgement is safe only if the
                // same ID is now visible with the exact immutable key set.
                $existing = $this->find($id);
                if ($existing === null) {
                    throw $error;
                }
            }
        }
        $actual = $existing->cache_keys;
        sort($actual, SORT_STRING);
        sort($keys, SORT_STRING);
        if ($actual !== $keys) {
            throw new InvalidArgumentException('Journal identifier snapshot mismatch.');
        }
        return $id;
    }

    public function find(string $id): ?object
    {
        $row = $this->rows()->where('id', $id)->first();
        if ($row !== null) {
            $row->cache_keys = json_decode($row->cache_keys, true, 512, JSON_THROW_ON_ERROR);
            $row->recovery_attempts = (int) $row->recovery_attempts;
            $row->initial_attempted = (bool) $row->initial_attempted;
        }
        return $row;
    }

    public function claim(string $id, bool $initial = false): ?object
    {
        $now = CarbonImmutable::now('UTC');
        $token = (string) Str::uuid();
        $query = $this->rows()->where('id', $id)->whereIn('state', ['pending', 'retry'])
            ->where('next_attempt_at', '<=', $now)->where('recovery_attempts', '<', 4);
        $values = ['state' => 'leased', 'lease_token' => $token, 'lease_expires_at' => $now->addSeconds(120), 'updated_at' => $now];
        if ($initial) {
            $query->where('initial_attempted', false)->where('recovery_attempts', 0);
            $values['initial_attempted'] = true;
        } else {
            $values['recovery_attempts'] = DB::raw('recovery_attempts + 1');
        }
        if ($query->update($values) !== 1) {
            return null;
        }
        $row = $this->find($id);
        // A paused claimant must never adopt a replacement worker's ownership.
        if ($row === null || $row->state !== 'leased' || $row->lease_token !== $token
            || CarbonImmutable::parse($row->lease_expires_at, 'UTC')->lessThanOrEqualTo(CarbonImmutable::now('UTC'))) {
            return null;
        }
        return $row;
    }

    private function failureValues(object $row, string $status, CarbonImmutable $now): array
    {
        $exhausted = $row->recovery_attempts >= 4;
        $delay = $row->recovery_attempts > 0 ? self::BACKOFF[min($row->recovery_attempts, 3) - 1] : 0;
        return [
            'state' => $exhausted ? 'exhausted' : 'retry',
            'last_status' => $exhausted ? 'attempts_exhausted' : $status,
            'next_attempt_at' => $now->addSeconds($delay), 'next_dispatch_at' => $now->addSeconds($delay),
            'lease_token' => null, 'lease_expires_at' => null, 'updated_at' => $now,
        ];
    }

    public function finish(string $id, string $token, bool $success, string $status): bool
    {
        if (! in_array($status, self::STATUSES, true)) {
            throw new InvalidArgumentException('Invalid journal status.');
        }
        $row = $this->find($id);
        if ($row === null) {
            return false;
        }
        $now = CarbonImmutable::now('UTC');
        $values = $success ? [
            'state' => 'completed', 'last_status' => 'success', 'completed_at' => $now,
            'lease_token' => null, 'lease_expires_at' => null, 'updated_at' => $now,
        ] : $this->failureValues($row, $status, $now);
        return $this->rows()->where('id', $id)->where('state', 'leased')
            ->where('lease_token', $token)->where('lease_expires_at', '>', $now)->update($values) === 1;
    }

    public function dispatch(string $id): void
    {
        try {
            $row = $this->find($id);
            if ($row === null) {
                return;
            }
            $now = CarbonImmutable::now('UTC');
            $age = CarbonImmutable::parse($row->created_at, 'UTC')->diffInSeconds($now);
            $delay = $age < 30 ? 30 : ($age < 150 ? 120 : 300);
            $next = $now->addSeconds($delay);
            $changed = $this->rows()->where('id', $id)->whereIn('state', ['pending', 'retry'])
                ->where('next_attempt_at', '<=', $now)->where('next_dispatch_at', '<=', $now)
                ->where('recovery_attempts', '<', 4)
                ->update(['next_dispatch_at' => $next, 'updated_at' => $now]);
            if ($changed !== 1) {
                return;
            }
            try {
                Bus::dispatch(new PurgeCloudflareCache([], journalId: $id));
            } catch (Throwable) {
                $this->rows()->where('id', $id)->whereIn('state', ['pending', 'retry'])
                    ->where('next_dispatch_at', $next)
                    ->update(['last_status' => 'enqueue_unavailable', 'updated_at' => $now]);
                $this->warn();
            }
        } catch (Throwable) {
            $this->warn();
        }
    }

    private function warn(): void
    {
        try {
            Log::warning('Storefront refresh journal submission unavailable.', ['status' => 'enqueue_unavailable']);
        } catch (Throwable) {
            // Diagnostics are never a second recovery store or control path.
        }
    }

    public function replay(int $limit = 100, int $maxSeconds = 20): int
    {
        $limit = max(0, min(100, $limit));
        $maxSeconds = max(0, min(20, $maxSeconds));
        if ($limit === 0 || $maxSeconds === 0) {
            return 0;
        }
        $deadline = hrtime(true) + $maxSeconds * 1_000_000_000;
        $now = CarbonImmutable::now('UTC');
        $rows = $this->rows()->where(function (Builder $query) use ($now) {
            $query->where(function (Builder $due) use ($now) {
                $due->whereIn('state', ['pending', 'retry'])->where('next_dispatch_at', '<=', $now)
                    ->where('next_attempt_at', '<=', $now)->where('recovery_attempts', '<', 4);
            })->orWhere(function (Builder $expired) use ($now) {
                $expired->where('state', 'leased')->where('lease_expires_at', '<=', $now);
            });
        })->orderBy('updated_at')->orderBy('id')->limit($limit)->get();
        $processed = 0;
        foreach ($rows as $row) {
            if (hrtime(true) >= $deadline) {
                break;
            }
            $processed++;
            if ($row->state === 'leased') {
                $this->rows()->where('id', $row->id)->where('state', 'leased')
                    ->where('lease_token', $row->lease_token)->where('lease_expires_at', $row->lease_expires_at)
                    ->where('lease_expires_at', '<=', CarbonImmutable::now('UTC'))
                    ->update($this->failureValues($row, 'lease_expired', CarbonImmutable::now('UTC')));
            }
            if (hrtime(true) < $deadline) {
                $this->dispatch($row->id);
            }
        }
        if (hrtime(true) < $deadline) {
            $cutoff = CarbonImmutable::now('UTC')->subDays(7);
            $ids = $this->rows()->where('state', 'completed')->where('completed_at', '<', $cutoff)
                ->orderBy('completed_at')->limit(100)->pluck('id');
            if ($ids->isNotEmpty() && hrtime(true) < $deadline) {
                $this->rows()->whereIn('id', $ids)->where('state', 'completed')->where('completed_at', '<', $cutoff)->delete();
            }
        }
        return $processed;
    }
}
