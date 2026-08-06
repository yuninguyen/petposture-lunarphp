<?php

namespace App\Notifications;

use App\Filament\Resources\UserResource;
use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;

class NewCustomerRegisteredNotification extends Notification
{
    use Queueable;

    public function __construct(private readonly User $user) {}

    public function via(object $notifiable): array
    {
        return ['database'];
    }

    public function toArray(object $notifiable): array
    {
        return [
            'type' => 'new_customer',
            'icon' => 'heroicon-o-user-plus',
            'color' => 'info',
            'title' => 'New Customer',
            'body' => "{$this->user->name} ({$this->user->email}) just created an account.",
            'url' => UserResource::getUrl('edit', ['record' => $this->user]),
        ];
    }
}
