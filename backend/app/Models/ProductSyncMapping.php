<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Lunar\Models\Product as LunarProduct;

class ProductSyncMapping extends Model
{
    protected $fillable = [
        'legacy_product_id',
        'lunar_product_id',
        'legacy_slug',
        'synced_at',
    ];

    protected $casts = [
        'synced_at' => 'datetime',
    ];

    public function legacyProduct()
    {
        return $this->belongsTo(Product::class, 'legacy_product_id');
    }

    public function lunarProduct()
    {
        return $this->belongsTo(LunarProduct::class, 'lunar_product_id');
    }
}
