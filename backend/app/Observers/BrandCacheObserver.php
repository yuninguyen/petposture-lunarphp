<?php

namespace App\Observers;

use App\Services\CloudflareCacheService;

class BrandCacheObserver
{
    public function saved(): void
    {
        app(CloudflareCacheService::class)->purgePaths(['/api/brands']);
    }

    public function deleted(): void
    {
        app(CloudflareCacheService::class)->purgePaths(['/api/brands']);
    }
}
