<?php

namespace App\Observers;

use App\Models\Setting;
use App\Services\PublicContentPurgeCoordinator;
use Illuminate\Support\Facades\Cache;

class SettingCacheObserver
{
    public function saved(Setting $setting): void
    {
        Cache::forget("setting:{$setting->key}");
        Cache::forget('public-api:settings:v1');
        app(PublicContentPurgeCoordinator::class)->purge();
    }

    public function deleted(Setting $setting): void
    {
        Cache::forget("setting:{$setting->key}");
        Cache::forget('public-api:settings:v1');
        app(PublicContentPurgeCoordinator::class)->purge();
    }
}
