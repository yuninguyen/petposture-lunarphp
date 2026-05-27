<?php

namespace App\Http\Resources\Api;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class OrderTrackResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $meta = (array) ($this->meta ?? []);

        return [
            'reference' => $this->reference,
            'tracking_number' => $meta['tracking_number'] ?? $this->reference,
            'status' => $this->status,
            'status_label' => str((string) $this->status)->replace('-', ' ')->title()->toString(),
            'fulfillment_status' => $meta['fulfillment_status'] ?? null,
            'estimated_delivery' => $meta['estimated_delivery'] ?? null,
            'tracking_url' => $meta['shipment_tracking_url'] ?? null,
            'updated_at' => optional($this->updated_at)?->toDateTimeString(),
        ];
    }
}
