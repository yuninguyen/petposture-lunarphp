<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\MorphTo;

class SeoMetadata extends Model
{
    protected $fillable = [
        'seoable_id',
        'seoable_type',
        'title',
        'description',
        'keyphrase',
        'og_title',
        'og_description',
        'og_image',
        'canonical_url',
        'is_indexable',
        'is_followable',
    ];

    protected $casts = [
        'is_indexable' => 'boolean',
        'is_followable' => 'boolean',
    ];

    public function seoable(): MorphTo
    {
        return $this->morphTo();
    }
}
