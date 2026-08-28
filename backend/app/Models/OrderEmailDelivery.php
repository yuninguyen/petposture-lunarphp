<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class OrderEmailDelivery extends Model
{
    public const STATUS_PENDING = 'pending';

    public const STATUS_SENDING = 'sending';

    public const STATUS_SENT = 'sent';

    public const STATUS_FAILED = 'failed';

    protected $fillable = [
        'delivery_key',
        'job_type',
        'order_id',
        'recipient',
        'status',
        'attempt_count',
        'provider_message_id',
        'last_error',
        'sending_at',
        'sent_at',
        'failed_at',
    ];

    protected function casts(): array
    {
        return [
            'sending_at' => 'datetime',
            'sent_at' => 'datetime',
            'failed_at' => 'datetime',
        ];
    }
}
