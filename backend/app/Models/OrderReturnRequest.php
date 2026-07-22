<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Lunar\Models\Order;

class OrderReturnRequest extends Model
{
    public const STATUS_REQUESTED = 'requested';
    public const STATUS_APPROVED = 'approved';
    public const STATUS_REJECTED = 'rejected';
    public const STATUS_COMPLETED = 'completed';

    protected $fillable = [
        'order_id',
        'status',
        'reason',
        'customer_note',
        'admin_note',
        'rma_address',
        'refund_amount_minor',
        'requested_at',
        'approved_at',
        'rejected_at',
        'completed_at',
        'meta',
    ];

    protected $casts = [
        'meta' => 'array',
        'requested_at' => 'datetime',
        'approved_at' => 'datetime',
        'rejected_at' => 'datetime',
        'completed_at' => 'datetime',
    ];

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    public function items(): HasMany
    {
        return $this->hasMany(OrderReturnRequestItem::class, 'return_request_id');
    }
}
