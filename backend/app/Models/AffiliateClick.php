<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Lunar\Models\Product;

class AffiliateClick extends Model
{
    protected $fillable = [
        'post_id',
        'product_id',
        'affiliate_network_id',
        'product_name',
        'target_url',
        'referrer',
    ];

    public function post(): BelongsTo
    {
        return $this->belongsTo(Post::class);
    }

    /** A Pick product, when the click came from a product page instead of a post. */
    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function network(): BelongsTo
    {
        return $this->belongsTo(AffiliateNetwork::class, 'affiliate_network_id');
    }
}
