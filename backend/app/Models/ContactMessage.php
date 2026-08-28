<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ContactMessage extends Model
{
    public const STATUS_RECEIVED = 'received';

    public const STATUS_QUEUED = 'queued';

    public const STATUS_SENT = 'sent';

    public const STATUS_FAILED = 'failed';

    public const STATUS_RETRIED = 'retried';

    protected $fillable = [
        'idempotency_key',
        'name',
        'email',
        'subject',
        'message',
        'order_number',
        'status',
        'attempts',
        'last_error',
        'admin_sent_at',
        'reply_sent_at',
        'sent_at',
        'failed_at',
    ];

    protected function casts(): array
    {
        return [
            'admin_sent_at' => 'datetime',
            'reply_sent_at' => 'datetime',
            'sent_at' => 'datetime',
            'failed_at' => 'datetime',
        ];
    }
}
