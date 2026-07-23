<?php

namespace App\Observers;

use App\Services\CloudflareCacheService;

class SettingCacheObserver
{
    public function saved(): void
    {
        app(CloudflareCacheService::class)->purgePaths(['/api/settings', '/api/checkout/payment-methods']);
    }

    public function deleted(): void
    {
        app(CloudflareCacheService::class)->purgePaths(['/api/settings', '/api/checkout/payment-methods']);
    }
}
