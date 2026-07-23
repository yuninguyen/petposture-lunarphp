<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Purges specific API URLs from Cloudflare's edge cache when the underlying
 * data changes (product/brand/post/setting saved). Only the deterministic,
 * non-personalized list/config endpoints are purged here — individual
 * product/post detail pages rely on the Cache Rule's short TTL instead,
 * since resolving their exact slug-based URL isn't worth the complexity.
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

    /**
     * @param  array<int, string>  $paths  API paths starting with a slash, e.g. '/api/products'
     */
    public function purgePaths(array $paths): void
    {
        if (! $this->isConfigured() || empty($paths)) {
            return;
        }

        $apiBase = rtrim(config('app.url'), '/');
        $files = array_map(fn (string $path) => $apiBase . '/' . ltrim($path, '/'), $paths);

        try {
            $response = Http::withToken(config('services.cloudflare.api_token'))
                ->post("https://api.cloudflare.com/client/v4/zones/" . config('services.cloudflare.zone_id') . "/purge_cache", [
                    'files' => $files,
                ]);

            if (! $response->successful()) {
                Log::warning('Cloudflare cache purge failed.', [
                    'status' => $response->status(),
                    'body' => $response->body(),
                    'files' => $files,
                ]);
            }
        } catch (\Throwable $e) {
            Log::warning('Cloudflare cache purge threw an exception.', [
                'message' => $e->getMessage(),
                'files' => $files,
            ]);
        }
    }
}
