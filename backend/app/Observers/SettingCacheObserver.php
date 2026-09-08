<?php

namespace App\Observers;

use App\Models\Setting;
use App\Services\PublicContentPurgeCoordinator;
use Illuminate\Support\Facades\Cache;

class SettingCacheObserver
{
    public function saved(Setting $setting): void
    {
        $keys = array_map(fn ($key) => "setting:{$key}", array_unique(array_filter([
            $setting->getOriginal('key'), $setting->key,
        ], fn ($key) => $key !== null && $key !== '')));
        foreach ($keys as $key) {
            Cache::forget($key);
        }
        app(PublicContentPurgeCoordinator::class)->requestPurge(array_values($keys), $setting->getConnectionName());
    }

    public function deleted(Setting $setting): void
    {
        $keys = array_map(fn ($key) => "setting:{$key}", array_unique(array_filter([
            $setting->getOriginal('key'), $setting->key,
        ], fn ($key) => $key !== null && $key !== '')));
        foreach ($keys as $key) {
            Cache::forget($key);
        }
        app(PublicContentPurgeCoordinator::class)->requestPurge(array_values($keys), $setting->getConnectionName());
    }
}
