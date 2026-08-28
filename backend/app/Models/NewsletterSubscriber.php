<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

/**
 * @property Carbon|null $confirmation_expires_at
 */
class NewsletterSubscriber extends Model
{
    public const STATUS_PENDING = 'pending';

    public const STATUS_SUBSCRIBED = 'subscribed';

    public const STATUS_UNSUBSCRIBED = 'unsubscribed';

    public const MAIL_PENDING = 'pending';

    public const MAIL_QUEUED = 'queued';

    public const MAIL_SENT = 'sent';

    public const MAIL_FAILED = 'failed';

    public const MAIL_RETRIED = 'retried';

    protected $fillable = [
        'email',
        'status',
        'confirmation_token',
        'confirmation_token_hash',
        'confirmation_expires_at',
        'confirmed_at',
        'unsubscribe_token',
        'unsubscribe_token_hash',
        'mail_status',
        'mail_attempts',
        'mail_last_error',
        'mail_sent_at',
        'mail_failed_at',
    ];

    protected $hidden = [
        'confirmation_token',
        'confirmation_token_hash',
        'unsubscribe_token',
        'unsubscribe_token_hash',
    ];

    protected function casts(): array
    {
        return [
            'confirmation_token' => 'encrypted',
            'unsubscribe_token' => 'encrypted',
            'confirmation_expires_at' => 'datetime',
            'confirmed_at' => 'datetime',
            'mail_sent_at' => 'datetime',
            'mail_failed_at' => 'datetime',
        ];
    }
}
