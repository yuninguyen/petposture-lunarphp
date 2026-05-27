<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CheckoutSession extends Model
{
    use HasFactory;

    protected $fillable = [
        'token',
        'user_id',
        'status',
        'payload',
        'totals',
        'payment_intent_id',
        'payment_client_secret',
        'currency',
        'order_reference',
        'expires_at',
    ];

    protected $casts = [
        'payload' => 'array',
        'totals' => 'array',
        'expires_at' => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
