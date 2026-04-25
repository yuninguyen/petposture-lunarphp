<?php

namespace App\Services;

use App\Models\OrderEvent;
use Lunar\Models\Order;

class OrderEventService
{
    public function record(
        Order $order,
        string $type,
        string $title,
        ?string $detail = null,
        array $meta = [],
        bool $dedupeAgainstLatest = true,
    ): OrderEvent {
        if ($dedupeAgainstLatest) {
            $latestEvent = $order->relationLoaded('orderEvents')
                ? $order->orderEvents->sortByDesc('id')->first()
                : $order->orderEvents()->latest('id')->first();

            if (
                $latestEvent
                && $latestEvent->type === $type
                && $latestEvent->detail === $detail
            ) {
                return $latestEvent;
            }
        }

        return $order->orderEvents()->create([
            'type' => $type,
            'title' => $title,
            'detail' => $detail,
            'meta' => $meta ?: null,
            'occurred_at' => now(),
        ]);
    }
}
