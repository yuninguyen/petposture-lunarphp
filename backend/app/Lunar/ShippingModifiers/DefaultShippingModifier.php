<?php

namespace App\Lunar\ShippingModifiers;

use Closure;
use Lunar\Base\ShippingModifier;
use Lunar\DataTypes\Price;
use Lunar\DataTypes\ShippingOption;
use Lunar\Facades\ShippingManifest;
use Lunar\Models\TaxClass;
use Lunar\Models\Contracts\Cart;

class DefaultShippingModifier extends ShippingModifier
{
    public function handle(Cart $cart, Closure $next)
    {
        $taxClass = TaxClass::first() ?? TaxClass::create(['name' => 'Default']);

        ShippingManifest::addOption(new ShippingOption(
            'Standard Shipping',
            'Standard Shipping',
            'standard',
            new Price(0, $cart->currency, 1),
            $taxClass,
            null,
            'standard'
        ));

        ShippingManifest::addOption(new ShippingOption(
            'Express Shipping',
            'Express Shipping',
            'express',
            new Price(2500, $cart->currency, 1),
            $taxClass,
            null,
            'express'
        ));

        return $next($cart);
    }
}
