<?php

namespace App\Http\Resources\Api;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Lunar\Models\Order;

class OrderCreatedResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        /** @var Order $order */
        $order = $this->resource;
        $expiresAt = $order->getAttribute('tracking_access_token_expires_at');

        return [
            'id' => (string) $order->id,
            'reference' => $order->reference,
            'status' => $order->status,
            'tracking_access_token' => $order->getAttribute('tracking_access_token'),
            'tracking_access_expires_at' => optional($expiresAt)?->toIso8601String(),
        ];
    }
}
