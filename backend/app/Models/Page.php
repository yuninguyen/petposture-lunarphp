<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Page extends Model
{
    protected $fillable = [
        'slug',
        'title',
        'content',
        'meta_title',
        'meta_description',
        'is_active',
        'is_core',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'is_core' => 'boolean',
    ];
}
