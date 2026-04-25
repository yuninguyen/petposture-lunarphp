<?php

namespace App\Traits;

use App\Models\SeoMetadata;
use Illuminate\Database\Eloquent\Relations\MorphOne;

trait HasSeo
{
    public function seo(): MorphOne
    {
        return $this->morphOne(SeoMetadata::class, 'seoable');
    }

    /**
     * Helper to get the SEO title or fallback to the model's name.
     */
    public function getSeoTitleAttribute(): string
    {
        return $this->seo?->title ?? $this->name ?? $this->title ?? '';
    }
}
