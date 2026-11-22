<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One more store a Pick can be bought from, after the first one (which lives in the product's own attributes).
 * The price is the store's own and is only shown together with a valid checked date, like the first store's.
 */
class PickMerchant extends Model
{
    protected $fillable = [
        'product_id',
        'position',
        'affiliate_network_id',
        'url',
        'price',
        'price_checked_date',
    ];

    protected $casts = [
        'position' => 'integer',
        'price' => 'decimal:2',
        'price_checked_date' => 'date:Y-m-d',
    ];

    public function network(): BelongsTo
    {
        return $this->belongsTo(AffiliateNetwork::class, 'affiliate_network_id');
    }
}
