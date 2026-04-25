<?php

namespace App\Support\Orders;

class OrderStateMachine
{
    private const ACTION_STATUS_MAP = [
        'markPaid' => 'payment-received',
        'markProcessing' => 'processing',
        'markShipped' => 'shipped',
        'markDelivered' => 'delivered',
        'cancelOrder' => 'cancelled',
    ];

    private const ALLOWED_TRANSITIONS = [
        'awaiting-payment' => ['payment-offline', 'payment-received', 'cancelled'],
        'payment-offline' => ['payment-received', 'cancelled'],
        'payment-received' => ['processing', 'cancelled'],
        'processing' => ['shipped', 'cancelled'],
        'shipped' => ['delivered'],
        'delivered' => [],
        'cancelled' => [],
    ];

    public function statusForAction(string $action): ?string
    {
        return self::ACTION_STATUS_MAP[$action] ?? null;
    }

    public function canTransition(string $currentStatus, string $targetStatus): bool
    {
        if ($currentStatus === $targetStatus) {
            return true;
        }

        return in_array($targetStatus, self::ALLOWED_TRANSITIONS[$currentStatus] ?? [], true);
    }

    public function availableActions(string $status): array
    {
        return collect(self::ACTION_STATUS_MAP)
            ->filter(fn (string $targetStatus) => $this->canTransition($status, $targetStatus))
            ->map(fn (string $targetStatus, string $action) => [
                'action' => $action,
                'target_status' => $targetStatus,
                'label' => $this->labelForAction($action),
            ])
            ->values()
            ->all();
    }

    public function applyDerivedStatuses(array $meta, string $currentStatus, string $targetStatus): array
    {
        $paymentStatus = $this->resolvePaymentStatus($meta, $currentStatus);

        $meta['fulfillment_status'] = match ($targetStatus) {
            'processing' => 'processing',
            'shipped' => 'shipped',
            'delivered' => 'delivered',
            'cancelled' => 'cancelled',
            default => 'unfulfilled',
        };

        $meta['payment_status'] = match ($targetStatus) {
            'awaiting-payment' => $this->isOfflineCollection($meta) ? 'pending' : 'awaiting-payment',
            'payment-offline' => 'pending',
            'payment-received' => 'paid',
            'cancelled' => $paymentStatus === 'paid' ? 'paid' : 'cancelled',
            default => $paymentStatus,
        };

        return $meta;
    }

    public function resolvePaymentStatus(array $meta, string $currentStatus): string
    {
        if (! empty($meta['payment_status'])) {
            return (string) $meta['payment_status'];
        }

        return match ($currentStatus) {
            'payment-received', 'processing', 'shipped', 'delivered' => 'paid',
            'cancelled' => 'cancelled',
            default => $this->isOfflineCollection($meta) ? 'pending' : 'awaiting-payment',
        };
    }

    public function resolveFulfillmentStatus(array $meta, string $currentStatus): string
    {
        if (! empty($meta['fulfillment_status'])) {
            return (string) $meta['fulfillment_status'];
        }

        return match ($currentStatus) {
            'shipped' => 'shipped',
            'delivered' => 'delivered',
            'processing' => 'processing',
            'cancelled' => 'cancelled',
            default => 'unfulfilled',
        };
    }

    public function statusTitle(string $status): string
    {
        return match ($status) {
            'payment-received' => 'Payment received',
            'processing' => 'Order processing',
            'shipped' => 'Order shipped',
            'delivered' => 'Order delivered',
            'cancelled' => 'Order cancelled',
            default => str($status)->replace('-', ' ')->title()->toString(),
        };
    }

    public function labelForAction(string $action): string
    {
        return match ($action) {
            'markPaid' => 'Mark paid',
            'markProcessing' => 'Mark processing',
            'markShipped' => 'Mark shipped',
            'markDelivered' => 'Mark delivered',
            'cancelOrder' => 'Cancel order',
            default => $action,
        };
    }

    private function isOfflineCollection(array $meta): bool
    {
        return ($meta['payment_collection'] ?? null) === 'offline'
            || ($meta['payment_method'] ?? null) === 'cod';
    }
}
