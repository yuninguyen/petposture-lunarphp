<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;

/**
 * Tells the admin the Pinterest connection needs attention: it was lost (no automatic posting until it is
 * reconnected) or it is about to expire.
 */
class PinterestConnectionNotification extends Notification
{
    use Queueable;

    public const LOST = 'lost';

    public const EXPIRING = 'expiring';

    public function __construct(private readonly string $kind, private readonly ?string $detail = null) {}

    public function via(object $notifiable): array
    {
        return ['database'];
    }

    public function toArray(object $notifiable): array
    {
        $lost = $this->kind === self::LOST;

        return [
            'type' => $lost ? 'pinterest_connection_lost' : 'pinterest_connection_expiring',
            'icon' => 'heroicon-o-exclamation-triangle',
            'color' => $lost ? 'danger' : 'warning',
            'title' => $lost ? 'Pinterest disconnected' : 'Pinterest connection expires soon',
            'body' => $lost
                ? 'Automatic posting is paused. Open Pinterest Pins and reconnect.'.($this->detail ? " ({$this->detail})" : '')
                : 'Reconnect Pinterest soon, or automatic posting will stop.',
            'url' => null,
        ];
    }
}
