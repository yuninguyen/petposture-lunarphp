<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AffiliateReport extends Model
{
    protected $fillable = [
        'affiliate_network_id',
        'date',
        'clicks',
        'conversions',
        'commission_amount',
        'synced_at',
    ];

    protected $casts = [
        'date' => 'date',
        'synced_at' => 'datetime',
        'commission_amount' => 'decimal:2',
    ];

    public function network(): BelongsTo
    {
        return $this->belongsTo(AffiliateNetwork::class, 'affiliate_network_id');
    }
}
