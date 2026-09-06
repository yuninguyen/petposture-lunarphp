<?php

namespace App\Services;

use App\Jobs\PurgeCloudflareCache;
use App\Support\CloudflarePurgeNotice;
use App\ValueObjects\CloudflarePurgeResult;
use Illuminate\Support\Facades\Log;

class PublicContentPurgeCoordinator
{
    public function __construct(
        private readonly CloudflareCacheService $cloudflare,
        private readonly CloudflarePurgeNotice $notice,
    ) {}

    public function purge(): CloudflarePurgeResult
    {
        if ($this->notice->hasAttempted()) {
            return $this->notice->result();
        }

        $result = $this->cloudflare->purgeAll();
        $this->notice->record($result);

        if ($result->configured && ! $result->successful) {
            Log::warning('Cloudflare cache purge pending retry.', [
                'status' => $result->status,
                'message' => $result->message,
            ]);

            PurgeCloudflareCache::dispatch();
        }

        return $result;
    }
}
