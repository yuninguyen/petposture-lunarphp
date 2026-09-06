<?php

namespace App\Observers;

use App\Models\SiteMedia;
use Illuminate\Support\Facades\Cache;
use Spatie\MediaLibrary\MediaCollections\Models\Media;

class SiteMediaLibraryCacheObserver
{
    public function saved(Media $media): void
    {
        $this->invalidate($media);
    }

    public function deleted(Media $media): void
    {
        $this->invalidate($media);
    }

    private function invalidate(Media $media): void
    {
        if ($media->model_type !== SiteMedia::class) {
            return;
        }

        Cache::forget("public-api:site-media:v1:{$media->collection_name}");
    }
}
