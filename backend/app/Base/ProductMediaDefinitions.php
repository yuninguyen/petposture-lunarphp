<?php

namespace App\Base;

use Lunar\Base\StandardMediaDefinitions;
use Spatie\MediaLibrary\HasMedia;
use Spatie\MediaLibrary\MediaCollections\Models\Media;

/**
 * Adds a WebP conversion on top of Lunar's standard product media
 * definitions, so product images uploaded via the admin panel get a
 * lighter-weight WebP variant alongside the original — without touching
 * the zoom/large/medium/small conversions Lunar already generates.
 */
class ProductMediaDefinitions extends StandardMediaDefinitions
{
    public function registerMediaConversions(HasMedia $model, ?Media $media = null): void
    {
        parent::registerMediaConversions($model, $media);

        $model->addMediaConversion('webp')
            ->performOnCollections(config('lunar.media.collection'))
            ->format('webp');
    }
}
