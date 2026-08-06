<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class PaymentWebhookEvent extends Model
{
    use HasFactory;

    protected $table = 'payment_webhook_events';

    protected $fillable = [
        'gateway',
        'event_id',
        'event_type',
        'external_reference',
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
