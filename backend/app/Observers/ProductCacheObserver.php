<?php

namespace App\Observers;

use App\Services\CloudflareCacheService;

class ProductCacheObserver
{
    public function saved(): void
    {
        app(CloudflareCacheService::class)->purgePaths(['/api/products', '/api/products/facets']);
    }

    public function deleted(): void
    {
        app(CloudflareCacheService::class)->purgePaths(['/api/products', '/api/products/facets']);
    }
}
