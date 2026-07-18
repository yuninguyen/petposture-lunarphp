<?php

namespace App\Services;

use App\Jobs\DispatchOutboundWebhook;
use App\Jobs\SendOrderLifecycleEmailJob;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use App\Support\Orders\OrderStateMachine;
use Lunar\Models\Order;

class OrderOperationsService
{
    public function __construct(
        private readonly OrderEventService $orderEventService,
        private readonly OrderStateMachine $stateMachine,
    ) {
    }

    private function stripe(): \App\Services\StripePaymentIntentService
    {
        return app(\App\Services\StripePaymentIntentService::class);
    }

    public function update(Order $order, array $payload, bool $enforceTransitions = true): Order
    {
        $meta = (array) ($order->meta ?? []);
        $targetStatus = ! empty($payload['status']) ? (string) $payload['status'] : null;
        $eventsToRecord = [];

        if (array_key_exists('tracking_number', $payload)) {
            $previousTrackingNumber = $meta['tracking_number'] ?? $order->reference;
            $meta['tracking_number'] = filled($payload['tracking_number'])
                ? trim((string) $payload['tracking_number'])
                : $order->reference;

            if ($meta['tracking_number'] !== $previousTrackingNumber) {
                $eventsToRecord[] = ['tracking.updated', 'Tracking number updated', $meta['tracking_number']];
            }
        }

        if (array_key_exists('shipment_carrier', $payload)) {
            $meta['shipment_carrier'] = filled($payload['shipment_carrier'])
                ? Str::slug((string) $payload['shipment_carrier'], '_')
                : 'manual';
        }

        if (array_key_exists('shipment_tracking_url', $payload)) {
            $meta['shipment_tracking_url'] = filled($payload['shipment_tracking_url'])
                ? trim((string) $payload['shipment_tracking_url'])
                : null;
        }

        $meta = $this->syncShipmentRecords($meta, (string) $order->status);

        if (array_key_exists('internal_note', $payload)) {
            $previousInternalNote = $meta['internal_note'] ?? null;
            $meta['internal_note'] = filled($payload['internal_note'])
                ? trim((string) $payload['internal_note'])
                : null;

            if ($meta['internal_note'] !== $previousInternalNote && $meta['internal_note']) {
                $eventsToRecord[] = ['internal_note.updated', 'Internal note updated', $meta['internal_note']];
            }
        }

        $updates = [
            'meta' => $meta,
        ];

        if ($targetStatus) {
            if ($enforceTransitions) {
                $this->guardTransition($order, $targetStatus);
            }
            $updates['status'] = $targetStatus;
            $meta = $this->applyStatusTimestamps($meta, (string) $order->status, $targetStatus);
            $meta = $this->stateMachine->applyDerivedStatuses($meta, (string) $order->status, $targetStatus);
            $meta = $this->syncShipmentRecords($meta, $targetStatus);
            $eventsToRecord[] = ['status.' . $targetStatus, $this->stateMachine->statusTitle($targetStatus), 'Order moved to ' . str($targetStatus)->replace('-', ' ')->title()->toString() . '.'];
            $updates['meta'] = $meta;
        }

        $order->update($updates);

        foreach ($eventsToRecord as [$type, $title, $detail]) {
            $this->orderEventService->record($order, $type, $title, $detail);
        }

        $refreshed = $order->refresh()->loadMissing(['lines', 'shippingAddress', 'billingAddress', 'orderEvents']);

        // Auto-refund via Stripe when admin cancels a paid order
        if ($targetStatus === 'cancelled') {
            $refreshedMeta = (array) ($refreshed->meta ?? []);
            $paymentIntentId = (string) ($refreshedMeta['payment_intent_id'] ?? '');
            $wasRefunded = ($refreshedMeta['refund_status'] ?? '') === 'refunded';

            if ($paymentIntentId && ! $wasRefunded && ($refreshedMeta['payment_status'] ?? '') === 'paid') {
                try {
                    $orderTotal = $refreshed->total;
                    $orderTotalMinor = is_object($orderTotal) && property_exists($orderTotal, 'value')
                        ? (int) $orderTotal->value
                        : (is_numeric($orderTotal) ? (int) $orderTotal : null);

                    $refund = $this->stripe()->refund($paymentIntentId, $orderTotalMinor);
                    $refreshedMeta['refund_status'] = 'refunded';
                    $refreshedMeta['refund_id'] = $refund['refund_id'];
                    $refreshedMeta['refunded_at'] = now()->toDateTimeString();
                    $refreshedMeta['refund_amount'] = $refund['amount'];
                    $refreshed->update(['meta' => $refreshedMeta]);
                    $this->orderEventService->record(
                        $refreshed,
                        'payment.refunded',
                        'Full refund issued',
                        "Auto-refund issued on cancellation (ref: {$refund['refund_id']})."
                    );
                } catch (\Throwable) {
                    $this->orderEventService->record(
                        $refreshed,
                        'payment.refund_failed',
                        'Auto-refund failed',
                        'Order cancelled but Stripe refund could not be issued automatically. Manual refund required.'
                    );
                }
            }
        }

        if ($targetStatus && $refreshed->customer_reference) {
            match ($targetStatus) {
                'payment-received' => SendOrderLifecycleEmailJob::dispatch($refreshed->id, 'payment-received'),
                'processing'       => SendOrderLifecycleEmailJob::dispatch($refreshed->id, 'processing'),
                'shipped'          => SendOrderLifecycleEmailJob::dispatch($refreshed->id, 'shipped'),
                'delivered'        => SendOrderLifecycleEmailJob::dispatch($refreshed->id, 'delivered'),
                'cancelled'        => SendOrderLifecycleEmailJob::dispatch($refreshed->id, 'cancelled'),
                default            => null,
            };
        }

        if ($targetStatus) {
            $this->dispatchOutboundWebhook($refreshed, $targetStatus);
        }

        return $refreshed->refresh();
    }

    public function performAction(Order $order, string $action, array $payload = []): Order
    {
        $actionPayload = $payload;
        $actionPayload['status'] = $this->statusForAction($action);

        return $this->update($order, $actionPayload, true);
    }

    public function createShipment(Order $order, array $payload): Order
    {
        $meta = (array) ($order->meta ?? []);
        $shipments = array_values(array_filter((array) ($meta['shipments'] ?? []), 'is_array'));
        $trackingNumber = trim((string) ($payload['tracking_number'] ?? ''));
        $carrier = filled($payload['shipment_carrier'] ?? null)
            ? Str::slug((string) $payload['shipment_carrier'], '_')
            : 'manual';
        $trackingUrl = filled($payload['shipment_tracking_url'] ?? null)
            ? trim((string) $payload['shipment_tracking_url'])
            : $this->resolveTrackingUrl($carrier, $trackingNumber);
        $timestamp = now()->toDateTimeString();
        $status = in_array((string) $order->status, ['shipped', 'delivered'], true)
            ? 'in_transit'
            : 'label_created';

        $shipments[] = [
            'id' => 'shp_' . Str::lower(Str::random(10)),
            'tracking_number' => $trackingNumber,
            'carrier' => $carrier,
            'tracking_url' => $trackingUrl,
            'status' => $status,
            'created_at' => $timestamp,
            'updated_at' => $timestamp,
            'shipped_at' => (string) $order->status === 'shipped' ? ($meta['shipped_at'] ?? $timestamp) : null,
            'delivered_at' => (string) $order->status === 'delivered' ? ($meta['delivered_at'] ?? $timestamp) : null,
        ];

        $meta['shipments'] = array_slice($shipments, -25);
        $meta['tracking_number'] = $trackingNumber;
        $meta['shipment_carrier'] = $carrier;
        $meta['shipment_tracking_url'] = $trackingUrl;

        $order->update([
            'meta' => $meta,
        ]);

        $this->orderEventService->record(
            $order,
            'shipment.created',
            'Shipment created',
            "Shipment {$trackingNumber} created for carrier " . strtoupper($carrier) . '.'
        );

        return $order->refresh()->loadMissing(['lines', 'shippingAddress', 'billingAddress', 'orderEvents']);
    }

    public function refundOrder(Order $order, ?int $amountMinor = null): Order
    {
        $meta = (array) ($order->meta ?? []);
        $paymentIntentId = (string) ($meta['payment_intent_id'] ?? '');

        if (! $paymentIntentId) {
            throw ValidationException::withMessages([
                'refund' => ['This order has no Stripe payment intent to refund.'],
            ]);
        }

        if (($meta['payment_status'] ?? '') !== 'paid') {
            throw ValidationException::withMessages([
                'refund' => ['Only paid orders can be refunded.'],
            ]);
        }

        $isFullRefund = $amountMinor === null;

        // Resolve order total for full-refund so placeholder mode records the correct amount.
        $resolvedAmount = $amountMinor;
        if ($isFullRefund) {
            $raw = $order->total;
            $resolvedAmount = is_object($raw) && property_exists($raw, 'value')
                ? (int) $raw->value
                : (is_numeric($raw) ? (int) $raw : null);
        }

        $refund = $this->stripe()->refund($paymentIntentId, $resolvedAmount);

        $meta['refund_status'] = 'refunded';
        $meta['refund_id'] = $refund['refund_id'];
        $meta['refunded_at'] = now()->toDateTimeString();
        $meta['refund_amount'] = $refund['amount'];

        if ($isFullRefund) {
            $meta['payment_status'] = 'refunded';
        }

        $order->update(['meta' => $meta]);

        $label = $isFullRefund ? 'Full refund issued' : 'Partial refund issued';
        $detail = $isFullRefund
            ? "Full refund issued via Stripe (ref: {$refund['refund_id']})."
            : 'Partial refund of ' . number_format($refund['amount'] / 100, 2) . " issued via Stripe (ref: {$refund['refund_id']}).";

        $this->orderEventService->record($order, 'payment.refunded', $label, $detail);

        return $order->refresh()->loadMissing(['lines', 'shippingAddress', 'billingAddress', 'orderEvents']);
    }

    /**
     * Manually correct the shipping total on an existing order (e.g. a
     * pricing bug undercharged shipping at checkout time) and recompute
     * the order total to match.
     */
    public function adjustShipping(Order $order, int $shippingTotalMinor): Order
    {
        $previousShippingTotal = $this->moneyToMinor($order->shipping_total);
        $subTotal = $this->moneyToMinor($order->sub_total);
        $discountTotal = $this->moneyToMinor($order->discount_total);
        $taxTotal = $this->moneyToMinor($order->tax_total);
        $newTotal = max(0, $subTotal + $shippingTotalMinor - $discountTotal + $taxTotal);

        $order->update([
            'shipping_total' => $shippingTotalMinor,
            'total' => $newTotal,
        ]);

        $this->orderEventService->record(
            $order,
            'order.corrected',
            'Shipping total corrected',
            sprintf(
                'Shipping total adjusted from $%s to $%s; order total is now $%s.',
                number_format($previousShippingTotal / 100, 2),
                number_format($shippingTotalMinor / 100, 2),
                number_format($newTotal / 100, 2),
            ),
            dedupeAgainstLatest: false,
        );

        return $order->refresh()->loadMissing(['lines', 'shippingAddress', 'billingAddress', 'orderEvents']);
    }

    private function moneyToMinor(mixed $amount): int
    {
        if (is_object($amount) && property_exists($amount, 'value')) {
            return (int) $amount->value;
        }

        return is_numeric($amount) ? (int) $amount : 0;
    }

    public function returnOrder(Order $order): Order
    {
        $allowedStatuses = ['delivered', 'shipped'];

        if (! in_array((string) $order->status, $allowedStatuses, true)) {
            throw ValidationException::withMessages([
                'return' => ['Only delivered or shipped orders can be marked as returned.'],
            ]);
        }

        $meta = (array) ($order->meta ?? []);
        $meta['fulfillment_status'] = 'returned';
        $meta['returned_at'] = now()->toDateTimeString();

        $order->update(['meta' => $meta]);

        $this->orderEventService->record(
            $order,
            'fulfillment.returned',
            'Items returned',
            'Order items marked as returned by admin.'
        );

        return $order->refresh()->loadMissing(['lines', 'shippingAddress', 'billingAddress', 'orderEvents']);
    }

    public function syncStripePayment(Order $order, array $paymentData): Order
    {
        $meta = (array) ($order->meta ?? []);
        $paymentStatus = (string) ($paymentData['payment_status'] ?? ($meta['payment_status'] ?? 'pending'));
        $intentStatus = (string) ($paymentData['payment_intent_status'] ?? ($meta['payment_intent_status'] ?? ''));
        $eventType = $paymentData['event_type'] ?? null;
        $eventId = $paymentData['event_id'] ?? null;

        $meta['payment_status'] = $paymentStatus;
        $meta['payment_intent_status'] = $intentStatus ?: null;
        $meta['payment_last_event_type'] = $eventType;
        $meta['payment_last_event_id'] = $eventId;
        $meta['payment_webhook_processed_at'] = now()->toDateTimeString();

        if (array_key_exists('fraud_risk_level', $paymentData)) {
            $meta['fraud_risk_level'] = $paymentData['fraud_risk_level'];
            $meta['fraud_risk_score'] = $paymentData['fraud_risk_score'] ?? null;
            $meta['fraud_seller_message'] = $paymentData['fraud_seller_message'] ?? null;
        }

        if (array_key_exists('card_brand', $paymentData)) {
            $meta['card_brand'] = $paymentData['card_brand'];
            $meta['card_last4'] = $paymentData['card_last4'] ?? null;
        }

        if (array_key_exists('amount_charged', $paymentData)) {
            $meta['amount_charged'] = $paymentData['amount_charged'];
            $meta['amount_charged_currency'] = $paymentData['amount_charged_currency'] ?? null;
        }

        $updates = [
            'meta' => $meta,
        ];

        $currentStatus = (string) $order->status;

        if ($paymentStatus === 'paid' && in_array($currentStatus, ['awaiting-payment', 'payment-offline'], true)) {
            $updates['status'] = 'payment-received';
            $meta = $this->applyStatusTimestamps($meta, $currentStatus, 'payment-received');
            $meta = $this->stateMachine->applyDerivedStatuses($meta, $currentStatus, 'payment-received');
            $meta['payment_received_at'] = $meta['payment_received_at'] ?? now()->toDateTimeString();
            $updates['meta'] = $meta;
        }

        if ($paymentStatus === 'failed' && $currentStatus === 'payment-received') {
            $updates['status'] = 'awaiting-payment';
            $meta = $this->applyStatusTimestamps($meta, $currentStatus, 'awaiting-payment');
            $meta = $this->stateMachine->applyDerivedStatuses($meta, $currentStatus, 'awaiting-payment');
            $meta['payment_status'] = 'failed';
            $updates['meta'] = $meta;
        }

        if ($paymentStatus === 'cancelled' && in_array($currentStatus, ['awaiting-payment', 'payment-offline'], true)) {
            $updates['status'] = 'cancelled';
            $meta = $this->applyStatusTimestamps($meta, $currentStatus, 'cancelled');
            $meta = $this->stateMachine->applyDerivedStatuses($meta, $currentStatus, 'cancelled');
            $updates['meta'] = $meta;
        }

        $order->update($updates);

        if ($paymentStatus === 'paid' && in_array($currentStatus, ['awaiting-payment', 'payment-offline'], true)) {
            $this->orderEventService->record(
                $order,
                'status.payment-received',
                $this->stateMachine->statusTitle('payment-received'),
                'Order moved to Payment Received.'
            );
        } elseif ($paymentStatus === 'paid') {
            $this->orderEventService->record(
                $order,
                'payment.paid',
                'Payment confirmed',
                $eventType ?: 'Payment gateway confirmed this charge.'
            );
        }

        if ($paymentStatus === 'failed' && $currentStatus === 'payment-received') {
            $this->orderEventService->record(
                $order,
                'payment.failed',
                'Payment failed',
                $eventType ?: 'Stripe reported a failed payment.'
            );

            if ($order->customer_reference) {
                SendOrderLifecycleEmailJob::dispatch($order->id, 'payment-failed');
            }
        }

        if ($paymentStatus === 'cancelled' && in_array($currentStatus, ['awaiting-payment', 'payment-offline'], true)) {
            $this->orderEventService->record(
                $order,
                'status.cancelled',
                $this->stateMachine->statusTitle('cancelled'),
                'Order moved to Cancelled.'
            );
        }

        return $order->refresh()->loadMissing(['lines', 'shippingAddress', 'billingAddress', 'orderEvents']);
    }

    public function availableActions(Order $order): array
    {
        return $this->stateMachine->availableActions((string) $order->status);
    }

    private function statusForAction(string $action): string
    {
        $status = $this->stateMachine->statusForAction($action);

        if (! $status) {
            throw ValidationException::withMessages([
                'action' => ['Unsupported order action.'],
            ]);
        }

        return $status;
    }

    private function dispatchOutboundWebhook(Order $order, string $status): void
    {
        $meta = (array) ($order->meta ?? []);

        DispatchOutboundWebhook::dispatch('order.' . $status, [
            'order_id'        => (string) $order->id,
            'reference'       => $order->reference,
            'status'          => $status,
            'customer_email'  => $order->customer_reference,
            'total_minor'     => is_object($order->total) && property_exists($order->total, 'value')
                ? (int) $order->total->value
                : (is_numeric($order->total) ? (int) $order->total : null),
            'currency'        => $order->currency_code,
            'tracking_number' => $meta['tracking_number'] ?? null,
            'payment_status'  => $meta['payment_status'] ?? null,
        ]);
    }

    private function guardTransition(Order $order, string $targetStatus): void
    {
        $currentStatus = (string) $order->status;

        if ($currentStatus === $targetStatus) {
            return;
        }

        if (! $this->stateMachine->canTransition($currentStatus, $targetStatus)) {
            throw ValidationException::withMessages([
                'status' => ["Invalid transition from {$currentStatus} to {$targetStatus}."],
            ]);
        }
    }

    private function applyStatusTimestamps(array $meta, string $currentStatus, string $targetStatus): array
    {
        if ($currentStatus === $targetStatus) {
            return $meta;
        }

        $timestamp = now()->toDateTimeString();

        if ($targetStatus === 'payment-received') {
            $meta['payment_received_at'] = $meta['payment_received_at'] ?? $timestamp;
        }

        if ($targetStatus === 'processing') {
            $meta['processing_started_at'] = $meta['processing_started_at'] ?? $timestamp;
        }

        if ($targetStatus === 'shipped') {
            $meta['shipped_at'] = $meta['shipped_at'] ?? $timestamp;
        }

        if ($targetStatus === 'delivered') {
            $meta['delivered_at'] = $meta['delivered_at'] ?? $timestamp;
        }

        if ($targetStatus === 'cancelled') {
            $meta['cancelled_at'] = $meta['cancelled_at'] ?? $timestamp;
        }

        return $meta;
    }


    private function syncShipmentRecords(array $meta, string $status): array
    {
        $trackingNumber = (string) (($meta['tracking_number'] ?? '') ?: '');

        if ($trackingNumber === '' || $trackingNumber === '0') {
            return $meta;
        }

        $shipments = array_values(array_filter((array) ($meta['shipments'] ?? []), 'is_array'));
        $latestIndex = array_key_last($shipments);
        $latest = $latestIndex !== null ? $shipments[$latestIndex] : null;

        $shipmentStatus = match ($status) {
            'delivered' => 'delivered',
            'shipped' => 'in_transit',
            default => 'label_created',
        };

        $shipmentPayload = [
            'tracking_number' => $trackingNumber,
            'carrier' => $meta['shipment_carrier'] ?? $latest['carrier'] ?? 'manual',
            'tracking_url' => $meta['shipment_tracking_url'] ?? $latest['tracking_url'] ?? $this->resolveTrackingUrl(
                (string) ($meta['shipment_carrier'] ?? $latest['carrier'] ?? 'manual'),
                $trackingNumber,
            ),
            'status' => $shipmentStatus,
            'shipped_at' => $meta['shipped_at'] ?? null,
            'delivered_at' => $meta['delivered_at'] ?? null,
            'updated_at' => now()->toDateTimeString(),
        ];

        if (is_array($latest) && ($latest['tracking_number'] ?? null) === $trackingNumber) {
            $shipments[$latestIndex] = array_merge($latest, $shipmentPayload);
        } else {
            $shipments[] = array_merge([
                'id' => 'shp_' . Str::lower(Str::random(10)),
                'created_at' => now()->toDateTimeString(),
            ], $shipmentPayload);
        }

        $meta['shipments'] = array_slice($shipments, -25);

        return $meta;
    }

    private function resolveTrackingUrl(string $carrier, string $trackingNumber): ?string
    {
        $carrier = Str::slug($carrier, '_');

        if ($trackingNumber === '') {
            return null;
        }

        return match ($carrier) {
            'ups' => 'https://www.ups.com/track?tracknum=' . urlencode($trackingNumber),
            'usps' => 'https://tools.usps.com/go/TrackConfirmAction?qtc_tLabels1=' . urlencode($trackingNumber),
            'fedex' => 'https://www.fedex.com/fedextrack/?trknbr=' . urlencode($trackingNumber),
            'dhl' => 'https://www.dhl.com/us-en/home/tracking/tracking-express.html?submit=1&tracking-id=' . urlencode($trackingNumber),
            default => null,
        };
    }
}
