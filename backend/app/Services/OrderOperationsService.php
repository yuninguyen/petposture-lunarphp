<?php

namespace App\Services;

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

    public function update(Order $order, array $payload, bool $enforceTransitions = false): Order
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

        return $order->refresh()->loadMissing(['lines', 'shippingAddress', 'billingAddress', 'orderEvents']);
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

        $meta['shipments'] = array_slice($shipments, -10);

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
