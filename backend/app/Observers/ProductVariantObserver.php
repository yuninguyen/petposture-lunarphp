<?php

namespace App\Observers;

use Illuminate\Support\Facades\Log;
use Lunar\Models\ProductVariant;

class ProductVariantObserver
{
    /**
     * Handle the ProductVariant "updated" event.
     */
    public function updated(ProductVariant $productVariant): void
    {
        if ($productVariant->isDirty('stock')) {
            $threshold = $productVariant->low_stock_threshold ?? 5; // Fallback to 5 if not set

            if ($productVariant->stock <= $threshold && $productVariant->stock > 0) {
                Log::warning("Low stock alert for Product Variant: {$productVariant->sku}. Current stock: {$productVariant->stock}. Threshold: {$threshold}");
                // Future: Send email or Slack notification
            }

            if ($productVariant->stock <= 0) {
                Log::error("Out of stock alert for Product Variant: {$productVariant->sku}.");
            }
        }
    }
}
