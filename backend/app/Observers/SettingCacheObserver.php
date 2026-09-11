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
        app(PublicContentPurgeCoordinator::class)->requestPurge(array_values($keys), $setting->getConnectionName());
        foreach ($keys as $key) {
            try {
                Cache::forget($key);
            } catch (\Throwable) {
                // Committed recovery owns mandatory eviction; early eviction is best effort.
            }
        }
    }

    public function deleted(Setting $setting): void
    {
        $keys = array_map(fn ($key) => "setting:{$key}", array_unique(array_filter([
            $setting->getOriginal('key'), $setting->key,
        ], fn ($key) => $key !== null && $key !== '')));
        app(PublicContentPurgeCoordinator::class)->requestPurge(array_values($keys), $setting->getConnectionName());
        foreach ($keys as $key) {
            try {
                Cache::forget($key);
            } catch (\Throwable) {
                // Committed recovery owns mandatory eviction; early eviction is best effort.
            }
        }
    }
}
