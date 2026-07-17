<?php

namespace App\Lunar\ShippingModifiers;

use App\Models\ShippingMethod;
use App\Services\ShippingService;
use Closure;
use Lunar\Base\ShippingModifier;
use Lunar\DataTypes\Price;
use Lunar\DataTypes\ShippingOption;
use Lunar\Facades\ShippingManifest;
use Lunar\Models\Contracts\Cart;
use Lunar\Models\Discount;
use Lunar\Models\TaxClass;

class DefaultShippingModifier extends ShippingModifier
{
    public function handle(Cart $cart, Closure $next)
    {
        $taxClass = TaxClass::first() ?? TaxClass::create(['name' => 'Default']);
        $shippingService = app(ShippingService::class);
        $subtotalMinor = (int) ($cart->sub_total?->value ?? 0);

        $isFreeShipping = false;
        if ($cart->coupon_code) {
            $discount = Discount::active()->where('coupon', $cart->coupon_code)->first();
            $isFreeShipping = (bool) ($discount?->data['free_shipping'] ?? false);
        }

        foreach (ShippingMethod::all() as $method) {
            $priceMinor = $shippingService->rateFor($method->code, $subtotalMinor, $isFreeShipping);

            ShippingManifest::addOption(new ShippingOption(
                $method->name,
                $method->name,
                $method->code,
                new Price($priceMinor, $cart->currency, 1),
                $taxClass,
                null,
                $method->code
            ));
        }

        return $next($cart);
    }
}
