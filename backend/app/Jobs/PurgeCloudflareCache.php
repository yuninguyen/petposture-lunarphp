<?php

namespace App\Jobs;

use App\Services\CloudflareCacheService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;
use RuntimeException;
use Throwable;

class PurgeCloudflareCache implements ShouldQueue
{
    use Dispatchable;
    use InteractsWithQueue;
    use Queueable;
    use SerializesModels;

    public int $tries = 4;

    /** @param list<string> $cacheKeys */
    public function __construct(public array $cacheKeys = [])
    {
        $this->cacheKeys = array_values(array_unique(array_filter($cacheKeys,
            fn ($key) => is_string($key) && preg_match('/\\A(?:setting:|public-api:site-media:v1:)[^\\x00-\\x20]{1,255}\\z/D', $key),
        )));
    }

    public function backoff(): array
    {
        return [30, 120, 300];
    }

    public function handle(CloudflareCacheService $cloudflare): void
    {
        foreach ($this->cacheKeys as $key) {
            \Illuminate\Support\Facades\Cache::forget($key);
        }
        $result = $cloudflare->purgeAll();

        if (! $result->successful) {
            throw new RuntimeException($result->message ?? 'Cloudflare cache purge failed.');
        }
    }

    public function failed(Throwable $exception): void
    {
        Log::error('Cloudflare cache purge retry exhausted.', []);
    }
}
