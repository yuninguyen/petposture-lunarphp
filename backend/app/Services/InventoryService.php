<?php

namespace App\Services;

use Illuminate\Validation\ValidationException;
use Lunar\Models\Cart;
use Lunar\Models\ProductVariant;

class InventoryService
{
    public function assertVariantCanFulfill(ProductVariant $variant, int $requestedQuantity, int $existingCartQuantity = 0): void
    {
        $requestedQuantity = max(0, $requestedQuantity);

        if ($requestedQuantity === 0 || $this->canBackorder($variant)) {
            return;
        }

        $availableStock = max(0, (int) ($variant->stock ?? 0));

        if ($requestedQuantity + max(0, $existingCartQuantity) > $availableStock) {
            throw ValidationException::withMessages([
                'quantity' => [
                    "Only {$availableStock} units of variant {$variant->sku} are currently available.",
                ],
            ]);
        }
    }

    public function assertCartCanFulfill(Cart $cart): void
    {
        $cart->loadMissing(['lines.purchasable']);

        foreach ($cart->lines as $line) {
            $purchasable = $line->purchasable;

            if ($purchasable instanceof ProductVariant) {
                $this->assertVariantCanFulfill($purchasable, (int) $line->quantity);
            }
        }
    }

    public function stockSnapshot(?ProductVariant $variant): array
    {
        if (! $variant) {
            return [
                'stock' => 0,
                'available' => false,
                'backorder' => false,
                'lowStockWarning' => false,
                'stockStatus' => 'out_of_stock',
            ];
        }

        $stock = (int) ($variant->stock ?? 0);
        $backorder = $this->canBackorder($variant);
        $lowStock = $stock > 0 && $stock <= (int) ($variant->low_stock_threshold ?? 5);

        return [
            'stock' => $stock,
            'available' => $stock > 0 || $backorder,
            'backorder' => $backorder,
            'lowStockWarning' => $lowStock,
            'stockStatus' => $backorder && $stock <= 0 ? 'backorder' : ($stock <= 0 ? 'out_of_stock' : ($lowStock ? 'low_stock' : 'in_stock')),
        ];
    }

    private function canBackorder(ProductVariant $variant): bool
    {
        return (bool) ($variant->backorder ?? false);
    }
}
