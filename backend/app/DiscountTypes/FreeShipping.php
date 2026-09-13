<?php

namespace App\DiscountTypes;

use Lunar\DiscountTypes\AbstractDiscountType;
use Lunar\Models\Contracts\Cart as CartContract;

class FreeShipping extends AbstractDiscountType
{
    /**
     * Return the name of the discount.
     */
    public function getName(): string
    {
        return 'Free shipping';
    }

    /**
     * Called just before cart totals are calculated.
     * Shipping zeroing is handled by DefaultShippingModifier via data.free_shipping.
     */
    public function apply(CartContract $cart): CartContract
    {
        return $cart;
    }
}
