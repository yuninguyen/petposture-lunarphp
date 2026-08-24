<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Lunar\Models\Product;

class ProductRedirect extends Model
{
    public const UPDATED_AT = null;

    protected $fillable = [
        'product_id',
        'old_slug',
    ];

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }
}
