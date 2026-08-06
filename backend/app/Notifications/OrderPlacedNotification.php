<?php

namespace App\Notifications;

use App\Filament\Resources\OrderResource\Pages\ViewOrder;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;
use Lunar\Models\Order;

class OrderPlacedNotification extends Notification
{
    use Queueable;

    public function __construct(private readonly Order $order) {}

    public function via(object $notifiable): array
    {
        return ['database'];
    }

    public function toArray(object $notifiable): array
    {
        return [
            'type' => 'order_placed',
            'icon' => 'heroicon-o-shopping-bag',
            'color' => 'success',
            'title' => 'New Order',
            'body' => "Order #{$this->order->reference} was placed".
                ($this->order->customer_reference ? " by {$this->order->customer_reference}" : '').'.',
            'url' => ViewOrder::getUrl(['record' => $this->order]),
        ];
    }
}
