<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class PayPalWebhookEvent extends Model
{
    use HasFactory;

    protected $table = 'paypal_webhook_events';

    protected $fillable = [
        'event_id',
        'event_type',
        'paypal_order_id',
        'order_id',
        'status',
        'payload',
        'processed_at',
    ];

    protected $casts = [
        'payload' => 'array',
        'processed_at' => 'datetime',
    ];
}
