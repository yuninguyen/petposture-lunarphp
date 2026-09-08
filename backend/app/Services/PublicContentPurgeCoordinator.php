<?php

namespace App\Services;

use App\Jobs\PurgeCloudflareCache;
use App\Support\CloudflarePurgeNotice;
use App\ValueObjects\CloudflarePurgeResult;
use App\Support\StorefrontMutationBatch;
use Illuminate\Support\Facades\Bus;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Throwable;

class PublicContentPurgeCoordinator
{
    public function __construct(
        private readonly CloudflareCacheService $cloudflare,
        private readonly CloudflarePurgeNotice $notice,
        private readonly StorefrontMutationBatch $batch,
    ) {}

    public function requestPurge(array $cacheKeys = [], ?string $connectionName = null): void
    {
        $keys = (new PurgeCloudflareCache($cacheKeys))->cacheKeys;
        $committed = function () use ($keys): void {
            if ($this->batch->isCollecting()) {
                $this->batch->addCommitted($keys);
            } else {
                $this->queue($keys);
            }
        };
        $connection = DB::connection($connectionName);
        if ($connection->transactionLevel() > 0) {
            // Laravel's generic afterCommit selects the last transaction across ALL
            // connections. Attach to this owning connection's exact transaction.
            $transaction = app('db.transactions')->getPendingTransactions()->last(
                fn ($transaction) => $transaction->connection === $connection->getName()
                    && $transaction->level === $connection->transactionLevel(),
            );
            $transaction->addCallback($committed);
        } else {
            $committed();
        }
    }

    public function flushCompletedMutation(): ?CloudflarePurgeResult
    {
        if (! $this->batch->hasChanges()) {
            return null;
        }

        $keys = $this->batch->drainCacheKeys();
        if (! $this->batch->isCollecting()) {
            $this->queue($keys);

            return null;
        }

        return $this->attempt($keys);
    }

    private function queue(array $keys): void
    {
        try {
            Bus::dispatch(new PurgeCloudflareCache($keys));
        } catch (Throwable) {
            $this->notice->markPending();
            Log::warning('Cloudflare cache purge retry dispatch unavailable.');
        }
    }

    public function purge(): CloudflarePurgeResult
    {
        if ($this->notice->hasAttempted()) {
            return $this->notice->result();
        }

        return $this->attempt([]);
    }

    private function attempt(array $keys): CloudflarePurgeResult
    {
        try {
            foreach ($keys as $key) {
                Cache::forget($key);
            }
            $result = $this->cloudflare->purgeAll();
        } catch (Throwable) {
            $result = new CloudflarePurgeResult(false, true, message: 'Cloudflare cache purge unavailable.');
        }
        $this->notice->record($result);

        if ($result->configured && ! $result->successful) {
            Log::warning('Cloudflare cache purge pending retry.', [
                'status' => $result->status,
            ]);

            $this->queue($keys);
        }

        return $result;
    }
}
