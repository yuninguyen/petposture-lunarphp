<?php

namespace App\Http\Resources\Api;

use App\Support\Orders\OrderStateMachine;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class OrderResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $shippingAddress = $this->shippingAddress;
        $billingAddress = $this->billingAddress ?? $shippingAddress;
        $total = $this->moneyValue($this->total);
        $subTotal = $this->moneyValue($this->sub_total);
        $taxTotal = $this->moneyValue($this->tax_total);
        $shippingTotal = $this->resolvedShippingTotal();
        $discountTotal = $this->moneyValue($this->discount_total);
        $paymentStatus = $this->resolvePaymentStatus();
        $fulfillmentStatus = $this->resolveFulfillmentStatus();
        $meta = $this->meta;

        return [
            'id' => (string) $this->id,
            'reference' => $this->reference,
            'status' => $this->status,
            'status_label' => __($this->status),
            'payment_status' => $paymentStatus,
            'payment_status_label' => $this->formatStatusLabel($paymentStatus),
            'fulfillment_status' => $fulfillmentStatus,
            'fulfillment_status_label' => $this->formatStatusLabel($fulfillmentStatus),
            'customer_email' => $this->customer_reference,
            'tracking_number' => $meta['tracking_number'] ?? $this->reference,
            'tax_state' => $meta['tax_state'] ?? null,
            'tax_rate_percentage' => (float) ($meta['tax_rate_percentage'] ?? 0),
            'tax_state_rate_percentage' => (float) ($meta['tax_state_rate_percentage'] ?? 0),
            'tax_avg_local_rate_percentage' => (float) ($meta['tax_avg_local_rate_percentage'] ?? 0),
            'tax_provider' => $meta['tax_provider'] ?? null,
            'tax_provider_requested' => $meta['tax_provider_requested'] ?? ($meta['tax_provider'] ?? null),
            'tax_provider_fallback_applied' => (bool) ($meta['tax_provider_fallback_applied'] ?? false),
            'tax_provider_fallback' => $meta['tax_provider_fallback'] ?? null,
            'tax_provider_fallback_reason' => $meta['tax_provider_fallback_reason'] ?? null,
            'tax_is_estimate' => (bool) ($meta['tax_is_estimate'] ?? true),
            'tax_source_label' => $meta['tax_source_label'] ?? null,
            'tax_source_url' => $meta['tax_source_url'] ?? null,
            'tax_effective_date' => $meta['tax_effective_date'] ?? null,
            'shipping_method' => $meta['shipping_method'] ?? null,
            'shipping_label' => $this->formatShippingLabel($meta['shipping_method'] ?? null),
            'coupon_code' => $meta['coupon_code'] ?? null,
            'payment_method' => $meta['payment_method'] ?? null,
            'payment_label' => $meta['payment_label'] ?? $this->formatPaymentLabel($meta['payment_method'] ?? null),
            'payment_gateway' => $meta['payment_gateway'] ?? null,
            'payment_collection' => $meta['payment_collection'] ?? null,
            'payment_instructions' => $meta['payment_instructions'] ?? null,
            'payment_intent_id' => $meta['payment_intent_id'] ?? null,
            'payment_intent_status' => $meta['payment_intent_status'] ?? null,
            'payment_last_event_type' => $meta['payment_last_event_type'] ?? null,
            'payment_received_at' => $meta['payment_received_at'] ?? null,
            'processing_started_at' => $meta['processing_started_at'] ?? null,
            'shipped_at' => $meta['shipped_at'] ?? null,
            'delivered_at' => $meta['delivered_at'] ?? null,
            'cancelled_at' => $meta['cancelled_at'] ?? null,
            'order_events' => collect(
                $this->whenLoaded('orderEvents', fn () => $this->orderEvents->map(fn ($event) => [
                    'type' => $event->type,
                    'title' => $event->title,
                    'detail' => $event->detail,
                    'created_at' => optional($event->occurred_at ?? $event->created_at)?->toDateTimeString(),
                ])->all(), (array) ($meta['order_events'] ?? []))
            )
                ->filter(fn ($event) => is_array($event))
                ->values()
                ->all(),
            'shipments' => collect($meta['shipments'] ?? [])
                ->filter(fn ($shipment) => is_array($shipment))
                ->map(fn ($shipment) => array_merge([
                    'tracking_url' => null,
                ], $shipment))
                ->values()
                ->all(),
            'available_actions' => app(\App\Services\OrderOperationsService::class)->availableActions($this->resource),
            'customer_note' => $meta['customer_note'] ?? $this->notes,
            'internal_note' => $meta['internal_note'] ?? null,
            'total' => [
                'formatted' => number_format($total, 2) . ' ' . $this->currency_code,
                'decimal' => $total,
                'currency' => $this->currency_code,
            ],
            'sub_total' => number_format($subTotal, 2),
            'tax_total' => number_format($taxTotal, 2),
            'shipping_total' => number_format($shippingTotal, 2),
            'discount_total' => number_format($discountTotal, 2),
            'created_at' => $this->created_at->toDateTimeString(),
            'notes' => $this->notes,
            'lines' => $this->lines->map(fn($line) => [
                'id' => $line->id,
                'type' => $line->type,
                'description' => $line->description,
                'quantity' => $line->quantity,
                'unit_price' => number_format($this->moneyValue($line->unit_price), 2),
                'sub_total' => number_format($this->moneyValue($line->sub_total), 2),
                'discount_total' => number_format($this->moneyValue($line->discount_total), 2),
                'tax_total' => number_format($this->moneyValue($line->tax_total), 2),
                'total' => number_format($this->moneyValue($line->total), 2),
                'image' => $this->resolveLineImage($line),
            ]),
            'shipping_address' => [
                'first_name' => $shippingAddress?->first_name,
                'last_name' => $shippingAddress?->last_name,
                'line_one' => $shippingAddress?->line_one,
                'line_two' => $shippingAddress?->line_two,
                'city' => $shippingAddress?->city,
                'state' => $shippingAddress?->state,
                'postcode' => $shippingAddress?->postcode,
                'country' => $shippingAddress?->country?->name ?? 'United States',
                'phone' => $shippingAddress?->contact_phone,
            ],
            'billing_address' => [
                'first_name' => $billingAddress?->first_name,
                'last_name' => $billingAddress?->last_name,
                'line_one' => $billingAddress?->line_one,
                'line_two' => $billingAddress?->line_two,
                'city' => $billingAddress?->city,
                'state' => $billingAddress?->state,
                'postcode' => $billingAddress?->postcode,
                'country' => $billingAddress?->country?->name ?? 'United States',
                'phone' => $billingAddress?->contact_phone,
            ],
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
        if (($line->type ?? null) === 'shipping') {
            return null;
        }

        $purchasable = $line->getRelationValue('purchasable');

        if (!$purchasable || !method_exists($purchasable, 'product') || !$purchasable->product) {
            return null;
        }

        return \App\Services\ProductSyncService::normalizePublicImageUrl(
            $purchasable->product->translateAttribute('image_url')
        );
    }

    private function resolvedShippingTotal(): float
    {
        $shippingTotal = $this->moneyValue($this->shipping_total);

        if ($shippingTotal > 0) {
            return $shippingTotal;
        }

        $shippingLine = $this->lines->firstWhere('type', 'shipping');

        if (!$shippingLine) {
            return 0.0;
        }

        return $this->moneyValue($shippingLine->total);
    }

    private function resolvePaymentStatus(): string
    {
        return app(OrderStateMachine::class)->resolvePaymentStatus(
            (array) ($this->meta ?? []),
            (string) $this->status,
        );
    }

    private function resolveFulfillmentStatus(): string
    {
        return app(OrderStateMachine::class)->resolveFulfillmentStatus(
            (array) ($this->meta ?? []),
            (string) $this->status,
        );
    }

    private function formatStatusLabel(?string $status): ?string
    {
        if (!$status) {
            return null;
        }

        return str($status)->replace('-', ' ')->title()->toString();
    }

    private function formatShippingLabel(?string $shippingMethod): string
    {
        if (!$shippingMethod) {
            return 'Standard';
        }

        return str($shippingMethod)
            ->replace(['_', '-'], ' ')
            ->title()
            ->toString();
    }

    private function formatPaymentLabel(?string $paymentMethod): string
    {
        if (!$paymentMethod) {
            return 'Payment';
        }

        return str($paymentMethod)
            ->replace(['_', '-'], ' ')
            ->title()
            ->toString();
    }
}
