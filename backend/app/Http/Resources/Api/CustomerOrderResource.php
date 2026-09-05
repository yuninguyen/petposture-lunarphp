<?php

namespace App\Http\Resources\Api;

use App\Services\ProductSyncService;
use App\Support\Orders\OrderStateMachine;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Facades\Lang;

class CustomerOrderResource extends JsonResource
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
        $meta = (array) ($this->meta ?? []);

        return [
            'id' => (string) $this->id,
            'reference' => $this->reference,
            'status' => $this->status,
            'status_label' => $this->translatedStatusLabel($this->status),
            'payment_status' => $paymentStatus,
            'payment_status_label' => $this->formatStatusLabel($paymentStatus),
            'fulfillment_status' => $fulfillmentStatus,
            'fulfillment_status_label' => $this->formatStatusLabel($fulfillmentStatus),
            'customer_email' => $this->customer_reference,
            'payment_method' => $meta['payment_method'] ?? null,
            'payment_label' => $meta['payment_label'] ?? $this->formatPaymentLabel($meta['payment_method'] ?? null),
            'payment_instructions' => $meta['payment_instructions'] ?? null,
            'shipping_label' => $this->formatShippingLabel($meta['shipping_method'] ?? null),
            'delivered_at' => $meta['delivered_at'] ?? null,
            'currency' => $this->currency_code,
            'total' => [
                'formatted' => '$'.number_format($total, 2),
                'decimal' => round($total, 2),
                'currency' => $this->currency_code,
            ],
            'sub_total' => round($subTotal, 2),
            'tax_total' => round($taxTotal, 2),
            'shipping_total' => round($shippingTotal, 2),
            'discount_total' => round($discountTotal, 2),
            'created_at' => $this->created_at->toDateTimeString(),
            'lines' => $this->lines->map(fn ($line) => [
                'id' => $line->id,
                'type' => $line->type,
                'description' => $line->description,
                'quantity' => $line->quantity,
                'unit_price' => round($this->moneyValue($line->unit_price), 2),
                'sub_total' => round($this->moneyValue($line->sub_total), 2),
                'discount_total' => round($this->moneyValue($line->discount_total), 2),
                'tax_total' => round($this->moneyValue($line->tax_total), 2),
                'total' => round($this->moneyValue($line->total), 2),
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
            'shipments' => collect($meta['shipments'] ?? [])
                ->filter(fn ($shipment) => is_array($shipment))
                ->reject(fn ($shipment) => ($shipment['carrier'] ?? null) === 'manual'
                    && ($shipment['tracking_number'] ?? null) === $this->reference)
                ->map(fn ($shipment) => array_merge([
                    'tracking_url' => null,
                ], $shipment))
                ->values()
                ->all(),
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

        if (! $purchasable || ! method_exists($purchasable, 'product') || ! $purchasable->product) {
            return null;
        }

        return ProductSyncService::normalizePublicImageUrl(
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

        if (! $shippingLine) {
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
        if (! $status) {
            return null;
        }

        return str($status)->replace('-', ' ')->title()->toString();
    }

    private function translatedStatusLabel(string $status): string
    {
        $key = 'admin.orders.statuses.'.$status;

        return Lang::has($key)
            ? __($key)
            : (string) $this->formatStatusLabel($status);
    }

    private function formatShippingLabel(?string $shippingMethod): string
    {
        if (! $shippingMethod) {
            return 'Standard';
        }

        return str($shippingMethod)
            ->replace(['_', '-'], ' ')
            ->title()
            ->toString();
    }

    private function formatPaymentLabel(?string $paymentMethod): string
    {
        if (! $paymentMethod) {
            return 'Payment';
        }

        return str($paymentMethod)
            ->replace(['_', '-'], ' ')
            ->title()
            ->toString();
    }
}
