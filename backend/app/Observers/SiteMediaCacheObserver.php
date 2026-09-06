<?php

namespace App\Observers;

use App\Models\SiteMedia;
use Illuminate\Support\Facades\Cache;

class SiteMediaCacheObserver
{
    public function saved(SiteMedia $siteMedia): void
    {
        $this->invalidate($siteMedia);
    }

    public function deleted(SiteMedia $siteMedia): void
    {
        $this->invalidate($siteMedia);
    }

    private function invalidate(SiteMedia $siteMedia): void
    {
        $collections = array_unique(array_filter([
            $siteMedia->getOriginal('collection'),
            $siteMedia->collection,
        ]));

        foreach ($collections as $collection) {
            Cache::forget("public-api:site-media:v1:{$collection}");
        }
    }
}
