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

    public int $timeout = 60;

    public ?string $journalId = null;

    /** @param list<string> $cacheKeys Legacy envelopes retain their original behavior. */
    public function __construct(public array $cacheKeys = [], ?string $journalId = null)
    {
        $this->journalId = $journalId;
        $this->cacheKeys = array_values(array_unique(array_filter($journalId === null ? $cacheKeys : [],
            fn ($key) => is_string($key) && preg_match('/\\A(?:setting:|public-api:site-media:v1:)[^\\x00-\\x20]{1,255}\\z/D', $key),
        )));
    }

    public function backoff(): array
    {
        return [30, 120, 300];
    }

    public function handle(CloudflareCacheService $cloudflare): void
    {
        if ($this->journalId !== null) {
            $result = $this->attemptJournal($cloudflare);
            if (! $result->successful) {
                throw new RuntimeException($result->message ?? 'Cloudflare cache purge failed.');
            }
            return;
        }
        foreach ($this->cacheKeys as $key) {
            \Illuminate\Support\Facades\Cache::forget($key);
        }
        $result = $cloudflare->purgeAll();

        if (! $result->successful) {
            throw new RuntimeException($result->message ?? 'Cloudflare cache purge failed.');
        }
    }

    public function attemptJournal(CloudflareCacheService $cloudflare, bool $initial = false): \App\ValueObjects\CloudflarePurgeResult
    {
        $journal = app(\App\Services\StorefrontRefreshJournal::class);
        $row = $journal->claim($this->journalId, $initial);
        if ($row === null) {
            // Queue acknowledgement is not proof that the initial refresh completed.
            // Conservatively leave initial completion unconfirmed; replay owns due work.
            return new \App\ValueObjects\CloudflarePurgeResult(! $initial, true,
                message: $initial ? 'Cache refresh completion could not be confirmed.' : null);
        }
        $status = 'eviction_failed';
        try {
            $evictionFailed = false;
            foreach ($row->cache_keys as $key) {
                try {
                    \Illuminate\Support\Facades\Cache::forget($key);
                } catch (Throwable) {
                    $evictionFailed = true;
                }
            }
            if ($evictionFailed) {
                throw new RuntimeException('Cache eviction unavailable.');
            }
            $status = 'refresh_failed';
            $result = $cloudflare->purgeAll();
            $status = ! $result->configured ? 'not_configured' : ($result->successful ? 'success' : 'refresh_failed');
        } catch (Throwable) {
            $result = new \App\ValueObjects\CloudflarePurgeResult(false, true, message: 'Cloudflare cache purge unavailable.');
        }
        $successful = $result->configured && $result->successful;
        if (! $journal->finish($row->id, $row->lease_token, $successful, $status)) {
            return new \App\ValueObjects\CloudflarePurgeResult(false, true, message: 'Cache refresh completion could not be confirmed.');
        }
        return $successful ? $result : new \App\ValueObjects\CloudflarePurgeResult(false, true, $result->status, 'Cloudflare cache purge pending.');
    }

    public function failed(Throwable $exception): void
    {
        try {
            Log::error('Cloudflare cache purge retry exhausted.', []);
        } catch (Throwable) {
            // A transport envelope cannot exhaust/reset the durable recovery budget.
        }
    }
}
