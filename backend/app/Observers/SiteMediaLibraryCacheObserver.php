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
        $types = [SiteMedia::class, (new SiteMedia)->getMorphClass()];
        if (! in_array($media->model_type, $types, true)
            && ! in_array($media->getOriginal('model_type'), $types, true)) {
            return;
        }

        $collections = array_unique(array_filter([
            $media->getOriginal('collection_name'),
            $media->collection_name,
        ]));

        $keys = array_map(fn ($collection) => "public-api:site-media:v1:{$collection}", $collections);
        foreach ($keys as $key) {
            Cache::forget($key);
        }
        app(\App\Services\PublicContentPurgeCoordinator::class)->requestPurge($keys, $media->getConnectionName());
    }
}
