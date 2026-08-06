<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AffiliateClick extends Model
{
    protected $fillable = [
        'post_id',
        'affiliate_network_id',
        'product_name',
        'target_url',
        'referrer',
    ];

    public function post(): BelongsTo
    {
        return $this->belongsTo(Post::class);
    }

    public function network(): BelongsTo
    {
        return $this->belongsTo(AffiliateNetwork::class, 'affiliate_network_id');
    }
}
