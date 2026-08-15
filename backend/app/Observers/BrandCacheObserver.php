<?php

namespace App\Observers;

use App\Services\CloudflareCacheService;

class BrandCacheObserver
{
    public function saved(): void
    {
        dispatch(fn () => app(CloudflareCacheService::class)->purgeAll())->afterResponse();
    }

    public function deleted(): void
    {
        dispatch(fn () => app(CloudflareCacheService::class)->purgeAll())->afterResponse();
    }
}
