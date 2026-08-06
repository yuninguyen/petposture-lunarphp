<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AffiliateNetwork extends Model
{
    protected $fillable = [
        'name',
        'slug',
        'logo',
        'active',
    ];

    protected $casts = [
        'active' => 'boolean',
    ];
}
