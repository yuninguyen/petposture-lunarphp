<?php

namespace App\Services;

use App\Jobs\PurgeCloudflareCache;
use App\Support\CloudflarePurgeNotice;
use App\ValueObjects\CloudflarePurgeResult;
use App\Support\StorefrontMutationBatch;
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
        // Validation happens at the durable handoff, without silently dropping keys.
        $keys = array_values(array_unique($cacheKeys));
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
        $id = $this->record($keys);
        if ($id === null) {
            return;
        }
        $this->notice->markPending();
        try {
            app(StorefrontRefreshJournal::class)->dispatch($id);
        } catch (Throwable) {
            // The committed journal, not the queue acknowledgement, owns recovery.
        }
    }

    private function record(array $keys): ?string
    {
        try {
            return app(StorefrontRefreshJournal::class)->record($keys);
        } catch (Throwable) {
            $this->notice->markRecoveryUnavailable();
            try {
                Log::critical('Storefront cache refresh recovery unavailable.', ['status' => 'journal_unavailable']);
            } catch (Throwable) {
                // Diagnostics must never replace a committed save or its original error.
            }
            return null;
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
        $id = $this->record($keys);
        if ($id === null) {
            return $this->notice->result();
        }
        try {
            $result = (new PurgeCloudflareCache([], journalId: $id))->attemptJournal($this->cloudflare, true);
        } catch (Throwable) {
            $result = new CloudflarePurgeResult(false, true, message: 'Cloudflare cache purge unavailable.');
        }
        $this->notice->record($result);

        if (! $result->successful) {
            $this->notice->markPending();
            try {
                app(StorefrontRefreshJournal::class)->dispatch($id);
            } catch (Throwable) {
                // Recording succeeded: replay can recover even when submission fails.
            }
            try {
                Log::warning('Cloudflare cache purge pending retry.', ['status' => $result->status]);
            } catch (Throwable) {
                // Logging is never recovery authority.
            }
        }

        return $result;
    }
}
