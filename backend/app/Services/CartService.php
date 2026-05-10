<?php

namespace App\Services;

use Illuminate\Support\Str;
use Lunar\Models\Cart;
use Lunar\Models\CartLine;
use Lunar\Models\Channel;
use Lunar\Models\Currency;
use Lunar\Models\ProductVariant;

class CartService
{
    /**
     * Resolve an existing cart or create a new one.
     * Auth users are matched by user_id; guests by a UUID token stored in meta.
     */
    public function resolveCart(?string $token, ?int $userId): Cart
    {
        if ($userId) {
            $cart = Cart::where('user_id', $userId)
                ->whereDoesntHave('order')
                ->latest()
                ->first();

            if ($cart) {
                return $cart;
            }
        }

        if ($token) {
            $cart = Cart::where('meta->token', $token)
                ->whereNull('user_id')
                ->whereDoesntHave('order')
                ->first();

            if ($cart) {
                return $cart;
            }
        }

        return Cart::create([
            'currency_id' => Currency::getDefault()->id,
            'channel_id'  => Channel::getDefault()->id,
            'user_id'     => $userId,
            'meta'        => ['token' => $token ?? Str::uuid()->toString()],
        ]);
    }

    /**
     * Add a variant to the cart (increments if already present).
     */
    public function addLine(Cart $cart, int $variantId, int $quantity): Cart
    {
        $variant = ProductVariant::findOrFail($variantId);
        $cart->add($variant, $quantity);
        return $this->fresh($cart);
    }

    /**
     * Update the quantity of an existing cart line. Removes if quantity <= 0.
     */
    public function updateLine(Cart $cart, int $lineId, int $quantity): Cart
    {
        $line = CartLine::where('cart_id', $cart->id)->findOrFail($lineId);

        if ($quantity <= 0) {
            $line->delete();
        } else {
            $line->update(['quantity' => $quantity]);
        }

        return $this->fresh($cart);
    }

    /**
     * Remove a specific line from the cart.
     */
    public function removeLine(Cart $cart, int $lineId): Cart
    {
        CartLine::where('cart_id', $cart->id)->where('id', $lineId)->delete();
        return $this->fresh($cart);
    }

    /**
     * Remove all lines from the cart.
     */
    public function clear(Cart $cart): void
    {
        $cart->lines()->delete();
    }

    /**
     * Merge guest cart lines into the user's cart, then delete the guest cart.
     */
    public function mergeGuestCart(string $guestToken, int $userId): void
    {
        $guestCart = Cart::where('meta->token', $guestToken)
            ->whereNull('user_id')
            ->whereDoesntHave('order')
            ->with('lines.purchasable')
            ->first();

        if (! $guestCart) {
            return;
        }

        $userCart = $this->resolveCart(null, $userId);

        if ($guestCart->id === $userCart->id) {
            return;
        }

        foreach ($guestCart->lines as $line) {
            if ($line->purchasable) {
                $userCart->add($line->purchasable, $line->quantity);
            }
        }

        $guestCart->lines()->delete();
        $guestCart->delete();
    }

    /**
     * Serialize a cart to the API response shape.
     */
    public function toArray(Cart $cart): array
    {
        $cart->calculate();
        $currency  = $cart->currency;
        $factor    = max(1, (int) ($currency->factor ?? 100));

        $lines = $cart->lines->map(function (CartLine $line) use ($currency, $factor) {
            $purchasable = $line->purchasable;
            $price = $purchasable?->prices
                ->where('currency_id', $currency->id)
                ->sortBy('min_quantity')
                ->first();

            return [
                'id'        => $line->id,
                'variantId' => $line->purchasable_id,
                'name'      => $purchasable?->translateAttribute('name') ?? '',
                'sku'       => $purchasable?->sku ?? '',
                'quantity'  => $line->quantity,
                'price'     => round(($price?->getRawOriginal('price') ?? 0) / $factor, 2),
                'total'     => round(($line->sub_total?->value ?? 0) / $factor, 2),
            ];
        })->values();

        return [
            'token'      => $cart->meta['token'] ?? null,
            'couponCode' => $cart->coupon_code,
            'lines'      => $lines,
            'subtotal'   => round(($cart->sub_total?->value ?? 0) / $factor, 2),
            'discount'   => round(($cart->discount_total?->value ?? 0) / $factor, 2),
            'total'      => round(($cart->total?->value ?? 0) / $factor, 2),
        ];
    }

    private function fresh(Cart $cart): Cart
    {
        return $cart->refresh()->load([
            'lines.purchasable.prices',
        ]);
    }
}
