<?php

namespace App\Filament\Resources;

use Awcodes\Curator\Resources\MediaResource as BaseCuratorMediaResource;

/**
 * Filament derives a resource's URL slug from the resource CLASS name, not
 * the model — Curator's vendor MediaResource is literally named
 * "MediaResource" too, so it silently collided with (and won the route
 * over) our own App\Filament\Resources\MediaResource at /admin/media.
 * Only override needed: a distinct slug.
 */
class CuratorMediaResource extends BaseCuratorMediaResource
{
    protected static ?string $slug = 'curator-media';
}
