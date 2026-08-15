<?php

namespace App\Observers;

use App\Models\Setting;
use App\Services\CloudflareCacheService;
use Illuminate\Support\Facades\Cache;

class SettingCacheObserver
{
    public function saved(Setting $setting): void
    {
        Cache::forget("setting:{$setting->key}");
        dispatch(fn () => app(CloudflareCacheService::class)->purgeAll())->afterResponse();
    }

    public function deleted(Setting $setting): void
    {
        Cache::forget("setting:{$setting->key}");
        dispatch(fn () => app(CloudflareCacheService::class)->purgeAll())->afterResponse();
    }
}
