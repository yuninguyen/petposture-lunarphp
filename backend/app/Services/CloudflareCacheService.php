<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Purges Cloudflare's edge cache when catalog/content data changes
 * (product/brand/post/setting saved).
 *
 * Originally purged specific URLs (files array), but that was verified
 * unreliable in production for this zone: purging a single file that was
 * cached via a Cache Rule's edge_ttl override_origin (needed since Laravel
 * sends Cache-Control: private) silently did nothing, while
 * `purge_everything` reliably worked (confirmed via manual MISS/HIT
 * testing). Admin saves are infrequent, so a full zone purge's cost — the
 * next visitor for any page waits one full origin round-trip — is
 * negligible compared to the unreliability of targeted purging here.
 *
 * Soft-fails like AfterShipService/IpIntelligenceService: this is a
 * non-critical side effect of an admin save, never worth blocking or
 * erroring the save itself over.
 */
class CloudflareCacheService
{
    public function isConfigured(): bool
    {
        return filled(config('services.cloudflare.api_token')) && filled(config('services.cloudflare.zone_id'));
    }

    public function purgeAll(): void
    {
        if (! $this->isConfigured()) {
            return;
        }

        try {
            $response = Http::withToken(config('services.cloudflare.api_token'))
                ->post('https://api.cloudflare.com/client/v4/zones/' . config('services.cloudflare.zone_id') . '/purge_cache', [
                    'purge_everything' => true,
                ]);

            if (! $response->successful()) {
                Log::warning('Cloudflare cache purge failed.', [
                    'status' => $response->status(),
                    'body' => $response->body(),
                ]);
            }
        } catch (\Throwable $e) {
            Log::warning('Cloudflare cache purge threw an exception.', [
                'message' => $e->getMessage(),
            ]);
        }
    }
}
