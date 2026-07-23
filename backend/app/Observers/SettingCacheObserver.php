<?php

namespace App\Observers;

use App\Services\CloudflareCacheService;

class SettingCacheObserver
{
    public function saved(): void
    {
        app(CloudflareCacheService::class)->purgeAll();
    }

    public function deleted(): void
    {
        app(CloudflareCacheService::class)->purgeAll();
    }
}
