<?php

namespace App\Observers;

use Illuminate\Support\Facades\Log;
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
                if (! in_array($newStatus, $this->allowedTransitions[$oldStatus]) && $newStatus !== $oldStatus) {
                    Log::error("Invalid order state transition attempted: {$oldStatus} -> {$newStatus} for Order #{$order->id}");
                    // In a production environment, we might want to throw an exception here
                    // throw new \Exception("Invalid order state transition: {$oldStatus} -> {$newStatus}");
                }
            }

            // Inventory Reduction Trigger
            if (in_array($newStatus, ['processing', 'payment-received']) && ! in_array($oldStatus, ['processing', 'payment-received'])) {
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

            if (! $purchasable instanceof ProductVariant) {
                continue;
            }

            if ($multiplier < 0) {
                $requestedQuantity = $line->quantity * -$multiplier;
                $decremented = $purchasable->newQuery()
                    ->whereKey($purchasable->getKey())
                    ->where('stock', '>=', $requestedQuantity)
                    ->decrement('stock', $requestedQuantity);

                if ($decremented === 0) {
                    $stockBeforeReduction = $purchasable->newQuery()
                        ->whereKey($purchasable->getKey())
                        ->value('stock');

                    Log::warning('Insufficient product variant stock while reducing order inventory.', [
                        'variant_id' => $purchasable->getKey(),
                        'sku' => $purchasable->sku,
                        'requested_quantity' => $requestedQuantity,
                        'stock_before_reduction' => $stockBeforeReduction,
                    ]);

                    continue;
                }

                // Only a line whose stock was actually decremented here should
                // ever be credited back on cancellation — otherwise a line
                // skipped for insufficient stock would gain stock it never lost.
                $line->update(['meta' => array_merge((array) $line->meta, ['inventory_reduced' => true])]);

                continue;
            }

            if (! (bool) (($line->meta ?? [])['inventory_reduced'] ?? false)) {
                continue;
            }

            $purchasable->increment('stock', $line->quantity * $multiplier);
            $line->update(['meta' => array_merge((array) $line->meta, ['inventory_reduced' => false])]);
        }
    }
}
