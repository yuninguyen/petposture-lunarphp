<?php

namespace App\Notifications;

use App\Filament\Resources\ReviewResource;
use App\Models\Review;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;

class NewReviewNotification extends Notification
{
    use Queueable;

    public function __construct(private readonly Review $review) {}

    public function via(object $notifiable): array
    {
        return ['database'];
    }

    public function toArray(object $notifiable): array
    {
        return [
            'type' => 'new_review',
            'icon' => 'heroicon-o-star',
            'color' => 'warning',
            'title' => 'New Review',
            'body' => "{$this->review->customer_name} left a {$this->review->rating}-star review.",
            'url' => ReviewResource::getUrl('edit', ['record' => $this->review]),
        ];
    }
}
