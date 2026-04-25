<?php

namespace App\Observers;

use Lunar\Models\Order;
use Lunar\Models\ProductVariant;

class OrderObserver
{
    protected $allowedTransitions = [
        'awaiting-payment' => ['payment-received', 'cancelled', 'payment-offline'],
        'payment-offline' => ['payment-received', 'cancelled'],
        'payment-received' => ['processing', 'cancelled'],
        'processing' => ['shipped', 'cancelled'],
        'shipped' => ['delivered'],
        'delivered' => [],
        'cancelled' => [],
    ];

    /**
     * Handle the Order "updated" event.
     */
    public function updated(Order $order): void
    {
        if ($order->wasChanged('status')) {
            $newStatus = $order->status;
            $oldStatus = $order->getOriginal('status');

            // Validate Transition
            if ($oldStatus && isset($this->allowedTransitions[$oldStatus])) {
                if (!in_array($newStatus, $this->allowedTransitions[$oldStatus]) && $newStatus !== $oldStatus) {
                    \Illuminate\Support\Facades\Log::error("Invalid order state transition attempted: {$oldStatus} -> {$newStatus} for Order #{$order->id}");
                    // In a production environment, we might want to throw an exception here
                    // throw new \Exception("Invalid order state transition: {$oldStatus} -> {$newStatus}");
                }
            }

            // Inventory Reduction Trigger
            if (in_array($newStatus, ['processing', 'payment-received']) && !in_array($oldStatus, ['processing', 'payment-received'])) {
                $this->adjustInventory($order, -1); // Decrease
            }

            // Inventory Restoration Trigger (on Cancel)
            if ($newStatus === 'cancelled' && in_array($oldStatus, ['processing', 'payment-received'])) {
                $this->adjustInventory($order, 1); // Increase back
            }
        }
    }

    /**
     * Adjust inventory for all physical lines in the order.
     */
    protected function adjustInventory(Order $order, int $multiplier): void
    {
        foreach ($order->lines as $line) {
            if (($line->type ?? null) === 'shipping') {
                continue;
            }

            $purchasable = $line->purchasable;

            if ($purchasable instanceof ProductVariant) {
                $purchasable->increment('stock', $line->quantity * $multiplier);
            }
        }
    }
}
