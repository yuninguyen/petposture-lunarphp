<?php

namespace App\Services;

use App\Models\Review;
use App\Models\User;
use Lunar\Models\Order;
use Lunar\Models\OrderLine;
use Lunar\Models\Product;
use Lunar\Models\ProductVariant;

class ReviewPurchaseEvidenceService
{
    public function find(Product $product, ?User $user, string $email): ?OrderLine
    {
        $orders = Order::query()
            ->with('lines.purchasable.product')
            ->when(
                $user,
                fn ($query) => $query->where('user_id', $user->id),
                fn ($query) => $query->whereRaw('LOWER(customer_reference) = ?', [strtolower($email)]),
            )
            ->latest('id')
            ->get();

        foreach ($orders as $order) {
            if (! $this->isPaidOrFulfilled($order)) {
                continue;
            }

            $line = $order->lines->first(fn (OrderLine $line) => $this->lineMatchesProduct($line, $product->id));
            if ($line instanceof OrderLine) {
                return $line;
            }
        }

        return null;
    }

    public function qualifies(Review $review): bool
    {
        if (! $review->lunar_order_id || ! $review->lunar_order_line_id || ! $review->customer_email) {
            return false;
        }

        $order = Order::query()->find($review->lunar_order_id);
        $line = OrderLine::query()->with('purchasable')->find($review->lunar_order_line_id);

        if (! $order || ! $line || (int) $line->order_id !== (int) $order->id) {
            return false;
        }

        $identityMatches = $review->user_id
            ? (int) $order->user_id === (int) $review->user_id
            : strtolower((string) $order->customer_reference) === strtolower($review->customer_email);

        return $identityMatches
            && $this->isPaidOrFulfilled($order)
            && $this->lineMatchesProduct($line, (int) $review->lunar_product_id);
    }

    private function isPaidOrFulfilled(Order $order): bool
    {
        $meta = (array) ($order->meta ?? []);

        return ($meta['payment_status'] ?? null) === 'paid'
            || in_array($order->status, [
                'paid',
                'payment-received',
                'shipped',
                'dispatched',
                'delivered',
                'fulfilled',
                'completed',
            ], true);
    }

    private function lineMatchesProduct(OrderLine $line, int $productId): bool
    {
        $purchasable = $line->purchasable;

        return $purchasable instanceof ProductVariant
            && (int) $purchasable->product_id === $productId;
    }
}
