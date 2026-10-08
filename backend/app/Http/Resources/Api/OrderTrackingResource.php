<?php

namespace App\Http\Resources\Api;

use App\Models\OrderReturnRequest;
use App\Models\ShippingMethod;
use App\Services\ProductSyncService;
use App\Services\ReturnRequestService;
use App\Support\Orders\VariantLabel;
use Carbon\Carbon;
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
        $returns = app(ReturnRequestService::class);

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
            // The last payment attempt was declined/abandoned (Stripe's payment_intent.payment_failed).
            // Some redirect methods (Afterpay) return without a redirect_status, so the page needs this.
            'payment_failed' => ($meta['payment_status'] ?? null) === 'failed',
            // Whether a return can still be requested (30 days from delivery) — the page dims the button after that.
            'return_window_open' => $returns->isWithinReturnWindow($order),
            'return_window_ends_at' => $returns->returnWindowEndsAt($order)?->toIso8601String(),
            // When each stage happened, for the headline of the confirmation page.
            'confirmed_at' => $this->isoDate($meta['payment_received_at'] ?? null),
            'shipped_at' => $this->isoDate($meta['shipped_at'] ?? null),
            'delivered_at' => $this->isoDate($meta['delivered_at'] ?? null),
            'cancelled_at' => $this->isoDate($meta['cancelled_at'] ?? null),
            'return_request' => $this->returnRequestSummary($order, $returns),
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
                    'variant_label' => VariantLabel::forLine($line),
                    'quantity' => $line->quantity,
                    'unit_price' => round($this->moneyValue($line->unit_price), 2),
                    'sub_total' => round($this->moneyValue($line->sub_total), 2),
                    'image' => $this->resolveLineImage($line),
                ])
                ->values(),
        ];
    }

    private function isoDate(mixed $value): ?string
    {
        if (! $value) {
            return null;
        }

        try {
            return Carbon::parse($value)->toIso8601String();
        } catch (\Throwable) {
            return null;
        }
    }

    /**
     * What the customer needs to follow their latest return request. The admin's internal note is never exposed,
     * and the return address only while the request is approved and waiting for the parcel.
     *
     * @return array<string, mixed>|null
     */
    private function returnRequestSummary(Order $order, ReturnRequestService $returns): ?array
    {
        $request = OrderReturnRequest::query()->where('order_id', $order->id)->latest('id')->first();

        if (! $request) {
            return null;
        }

        return [
            'status' => $request->status,
            'requested_at' => $request->requested_at?->toIso8601String(),
            'approved_at' => $request->approved_at?->toIso8601String(),
            'package_received_at' => $request->package_received_at?->toIso8601String(),
            'completed_at' => $request->completed_at?->toIso8601String(),
            'tracking_deadline_at' => $returns->trackingDeadline($request)?->toIso8601String(),
            'rma_address' => $request->status === OrderReturnRequest::STATUS_APPROVED ? $request->rma_address : null,
            'return_carrier' => $request->return_carrier,
            'return_tracking_number' => $request->return_tracking_number,
            'return_tracking_url' => $request->return_tracking_url,
            'refund_amount' => $request->refund_amount_minor !== null ? $request->refund_amount_minor / 100 : null,
            'restocking_fee' => $request->restocking_fee_minor !== null ? $request->restocking_fee_minor / 100 : null,
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

        return ShippingMethod::where('code', $code)->value('name')
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
