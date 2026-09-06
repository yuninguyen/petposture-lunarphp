<?php

namespace App\Observers;

use App\Models\SiteMedia;
use App\Services\PublicContentPurgeCoordinator;
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
        Cache::forget("public-api:site-media:v1:{$siteMedia->collection}");
        app(PublicContentPurgeCoordinator::class)->purge();
    }
}
