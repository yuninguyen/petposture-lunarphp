<?php

namespace App\Observers;

use App\Services\CloudflareCacheService;

class PostCacheObserver
{
    public function saved(): void
    {
        app(CloudflareCacheService::class)->purgePaths(['/api/posts', '/api/blog/categories', '/api/categories']);
    }

    public function deleted(): void
    {
        app(CloudflareCacheService::class)->purgePaths(['/api/posts', '/api/blog/categories', '/api/categories']);
    }
}
