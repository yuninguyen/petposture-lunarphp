<?php

namespace App\Http\Resources\Api;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Str;
use Lunar\Models\Order;

class OrderTrackingResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        /** @var Order $order */
        $order = $this->resource;
        $meta = (array) ($order->meta ?? []);
        $shipment = collect($meta['shipments'] ?? [])
            ->filter(fn ($item): bool => is_array($item))
            ->reject(fn (array $item): bool => ($item['carrier'] ?? null) === 'manual'
                && ($item['tracking_number'] ?? null) === $order->reference)
            ->last();
        $address = $order->shippingAddress;
        $trackingToken = $order->getAttribute('tracking_access_token');

        return [
            'reference' => $order->reference,
            'tracking_access_token' => $this->when($trackingToken !== null, $trackingToken),
            'status' => $order->status,
            'fulfillment_status' => $this->fulfillmentStatus($order, $meta),
            'carrier' => is_array($shipment) ? ($shipment['carrier'] ?? null) : null,
            'tracking_number' => is_array($shipment) ? ($shipment['tracking_number'] ?? null) : null,
            'tracking_url' => is_array($shipment) ? ($shipment['tracking_url'] ?? null) : null,
            'eta' => is_array($shipment)
                ? ($shipment['estimated_delivery_at'] ?? $shipment['eta'] ?? null)
                : ($meta['estimated_delivery_at'] ?? null),
            'shipping_address' => [
                'city' => $address?->city,
                'state' => $address?->state,
                'postcode' => $this->maskPostcode($address?->postcode),
                'country' => $address?->country?->name,
            ],
        ];
    }

    private function fulfillmentStatus(Order $order, array $meta): string
    {
        return match ($order->status) {
            'delivered' => 'delivered',
            'shipped' => 'shipped',
            default => (string) ($meta['fulfillment_status'] ?? 'unfulfilled'),
        };
    }

    private function maskPostcode(?string $postcode): ?string
    {
        $postcode = trim((string) $postcode);

        if ($postcode === '') {
            return null;
        }

        return Str::substr($postcode, 0, min(3, Str::length($postcode))).'***';
    }
}
