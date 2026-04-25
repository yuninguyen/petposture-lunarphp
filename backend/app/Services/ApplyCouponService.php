<?php

namespace App\Services;

use Illuminate\Support\Collection;
use Lunar\Base\DiscountManagerInterface;
use Lunar\DiscountTypes\AmountOff;
use Lunar\Models\Cart;
use Lunar\Models\Channel;
use Lunar\Models\Currency;
use Lunar\Models\Discount;
use Lunar\Models\ProductVariant;

class ApplyCouponService
{
    public function execute(array $payload): array
    {
        $discount = Discount::active()->where('coupon', $payload['coupon_code'])->first();

        if (! $discount) {
            return [
                'status' => 404,
                'body' => [
                    'success' => false,
                    'message' => 'Coupon code not found or expired.',
                ],
            ];
        }

        $currency = Currency::getDefault();
        $channel = Channel::getDefault();

        if (! $currency || ! $channel) {
            return [
                'status' => 500,
                'body' => [
                    'success' => false,
                    'message' => 'System configuration error: Default currency or channel missing.',
                ],
            ];
        }

        $cart = Cart::create([
            'currency_id' => $currency->id,
            'channel_id' => $channel->id,
        ]);

        foreach ($payload['items'] as $item) {
            $variant = ProductVariant::findOrFail($item['variantId']);
            $cart->add($variant, $item['quantity']);
        }

        $cart->coupon_code = $payload['coupon_code'];
        $cart->discounts = collect();
        $cart->discountBreakdown = collect();

        $cart = app(DiscountManagerInterface::class)
            ->resetDiscounts()
            ->apply($cart);

        $discountTotal = $cart->lines->sum(fn ($line) => $line->discountTotal?->value ?? 0) / $currency->factor;
        $couponPayload = $this->buildCouponPayload($discount, $currency);

        if ($discountTotal <= 0 && ! $couponPayload['free_shipping']) {
            return [
                'status' => 422,
                'body' => [
                    'success' => false,
                    'message' => 'Coupon is valid but does not apply to these items.',
                ],
            ];
        }

        return [
            'status' => 200,
            'body' => [
                'success' => true,
                'message' => 'Coupon applied successfully.',
                'discount_amount' => $discountTotal,
                'coupon' => $couponPayload,
                '_v' => 3,
            ],
        ];
    }

    private function buildCouponPayload(Discount $discount, Currency $currency): array
    {
        $data = $discount->data ?? [];
        $type = 'fixed_cart';
        $amount = null;

        if ($discount->type === AmountOff::class && ! ($data['fixed_value'] ?? false)) {
            $type = 'percentage';
            $amount = (float) ($data['percentage'] ?? 0);
        } elseif ($discount->type === \App\Lunar\DiscountTypes\FixedAmountOffPerUnit::class) {
            $type = 'fixed_product';
            $amount = ((float) ($data['fixed_values'][$currency->code] ?? 0)) / $currency->factor;
        } else {
            $amount = ((float) ($data['fixed_values'][$currency->code] ?? 0)) / $currency->factor;
        }

        return [
            'code' => $discount->coupon,
            'type' => $type,
            'amount' => $amount,
            'free_shipping' => (bool) ($data['free_shipping'] ?? false),
        ];
    }
}
