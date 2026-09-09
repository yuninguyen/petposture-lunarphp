<?php

namespace App\Services;

use App\ValueObjects\CloudflarePurgeResult;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use RuntimeException;
use Throwable;

class StorefrontCacheRefreshService
{
    public function __construct(private readonly CloudflareCacheService $cloudflare) {}

    /** One attempt; the journal owns retries and its immutable key snapshot. */
    public function refresh(array $keys): CloudflarePurgeResult
    {
        try {
            foreach (DB::getConnections() as $connection) {
                if ($connection->transactionLevel() > 0) {
                    throw new RuntimeException('Active transaction.');
                }
            }
            $failed = false;
            foreach ($keys as $key) {
                try {
                    Cache::forget($key);
                } catch (Throwable) {
                    $failed = true;
                }
            }
            if ($failed) {
                throw new RuntimeException('Cache eviction unavailable.');
            }
            $deadline = hrtime(true) / 1e9 + 30;
            $transport = new StorefrontRevalidationService;
            $expected = $transport->expected($deadline);
            $transport->invalidate($deadline);
            $freshness = new StorefrontOriginFreshnessService;
            // One sequential pair is within the at-most-three-pair budget. Any mismatch
            // fails this attempt; a journal retry starts with eviction and fresh expected data.
            foreach ([1, 2] as $read) {
                if (! $freshness->matches($transport->homepage($deadline), $expected) || hrtime(true) / 1e9 >= $deadline) {
                    throw new RuntimeException('Origin projection mismatch.');
                }
            }

            return $this->cloudflare->purgeAll();
        } catch (Throwable) {
            return new CloudflarePurgeResult(false, true, message: 'Storefront cache refresh unavailable.');
        }
    }
}
