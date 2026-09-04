<?php

namespace App\Http\Resources\Api;

use App\Services\ProductSyncService;
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
        $billing = $order->billingAddress ?? $address;
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
            'customer_email' => $order->customer_reference,
            'shipping_address' => [
                'first_name' => $address?->first_name,
                'last_name' => $address?->last_name,
                'line_one' => $address?->line_one,
                'line_two' => $address?->line_two,
                'city' => $address?->city,
                'state' => $address?->state,
                'postcode' => $address?->postcode,
                'country' => $address?->country?->name,
                'phone' => $address?->contact_phone,
            ],
            'billing_address' => [
                'first_name' => $billing?->first_name,
                'last_name' => $billing?->last_name,
                'line_one' => $billing?->line_one,
                'line_two' => $billing?->line_two,
                'city' => $billing?->city,
                'state' => $billing?->state,
                'postcode' => $billing?->postcode,
                'country' => $billing?->country?->name,
                'phone' => $billing?->contact_phone,
            ],
            'payment_label' => $meta['payment_label'] ?? null,
            'card_brand' => $meta['card_brand'] ?? null,
            'card_last4' => $meta['card_last4'] ?? null,
            'payment_confirmed_before_cancellation' => $this->when(
                $order->status === 'cancelled',
                fn () => ($meta['payment_status'] ?? null) === 'paid'
            ),
            'refund_status' => $meta['refund_status'] ?? null,
            'created_at' => $order->created_at?->toIso8601String(),
            'shipping_method' => $this->shippingMethodLabel($meta),
            'total' => round($this->moneyValue($order->total), 2),
            'sub_total' => round($this->moneyValue($order->sub_total), 2),
            'shipping_total' => round($this->moneyValue($order->shipping_total), 2),
            'tax_total' => round($this->moneyValue($order->tax_total), 2),
            'discount_total' => round($this->moneyValue($order->discount_total), 2),
            'currency' => $order->currency_code,
            'lines' => $order->lines
                ->where('type', '!=', 'shipping')
                ->map(fn ($line) => [
                    'id' => $line->id,
                    'description' => $line->description,
                    'quantity' => $line->quantity,
                    'unit_price' => round($this->moneyValue($line->unit_price), 2),
                    'sub_total' => round($this->moneyValue($line->sub_total), 2),
                    'image' => $this->resolveLineImage($line),
                ])
                ->values(),
        ];
    }

    private function moneyValue(mixed $amount): float
    {
        if (is_object($amount) && method_exists($amount, 'decimal')) {
            return (float) $amount->decimal();
        }

        if (is_numeric($amount)) {
            return ((float) $amount) / 100;
        }

        return 0.0;
    }

    private function resolveLineImage(mixed $line): ?string
    {
        $purchasable = $line->getRelationValue('purchasable');

        if (! $purchasable || ! method_exists($purchasable, 'product') || ! $purchasable->product) {
            return null;
        }

        return ProductSyncService::normalizePublicImageUrl(
            $purchasable->product->translateAttribute('image_url')
        );
    }

    private function shippingMethodLabel(array $meta): string
    {
        $code = $meta['shipping_method'] ?? null;

        if (! $code) {
            return 'Standard';
        }

        return \App\Models\ShippingMethod::where('code', $code)->value('name')
            ?? Str::of($code)->replace(['_', '-'], ' ')->title()->toString();
    }

    private function fulfillmentStatus(Order $order, array $meta): string
    {
        return match ($order->status) {
            'delivered' => 'delivered',
            'shipped' => 'shipped',
            default => (string) ($meta['fulfillment_status'] ?? 'unfulfilled'),
        };
    }

}
