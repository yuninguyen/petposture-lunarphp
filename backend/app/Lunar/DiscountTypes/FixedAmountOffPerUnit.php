<?php

namespace App\Lunar\DiscountTypes;

use Lunar\Base\ValueObjects\Cart\DiscountBreakdown;
use Lunar\Base\ValueObjects\Cart\DiscountBreakdownLine;
use Lunar\DataTypes\Price;
use Lunar\DiscountTypes\AmountOff;
use Lunar\Models\Contracts\Cart as CartContract;

class FixedAmountOffPerUnit extends AmountOff
{
    /**
     * Return the name of the discount.
     */
    public function getName(): string
    {
        return 'Fixed amount per unit';
    }

    /**
     * Called just before cart totals are calculated.
     */
    public function apply(CartContract $cart): CartContract
    {
        $data = $this->discount->data;

        if (!$this->checkDiscountConditions($cart)) {
            return $cart;
        }

        // We only support fixed values for this type (not percentage)
        return $this->applyFixedValuePerUnit(
            values: $data['fixed_values'] ?? [],
            cart: $cart,
        );
    }

    /**
     * Apply fixed value discount PER UNIT
     */
    private function applyFixedValuePerUnit(array $values, CartContract $cart): CartContract
    {
        $currency = $cart->currency;
        $decimal = ($values[$currency->code] ?? 0) / $currency->factor;
        $unitValue = (int) bcmul($decimal, $currency->factor);

        if (!$unitValue) {
            return $cart;
        }

        $lines = $this->getEligibleLines($cart);
        $affectedLines = collect();
        $totalDiscountAmount = 0;

        foreach ($lines as $line) {
            $subTotal = ($line->subTotalDiscounted ?? $line->subTotal)->value;

            // Fixed discount PER UNIT
            $amount = $unitValue * $line->quantity;

            if ($amount > $subTotal) {
                $amount = $subTotal;
            }

            // If this line already has a greater discount value
            if ($line->discountTotal->value > $amount) {
                continue;
            }

            $totalDiscountAmount += $amount;

            $line->discountTotal = new Price(
                $amount,
                $cart->currency,
                1
            );

            $line->subTotalDiscounted = new Price(
                $line->subTotal->value - $amount,
                $cart->currency,
                1
            );

            $affectedLines->push(new DiscountBreakdownLine(
                line: $line,
                quantity: $line->quantity
            ));
        }

        if ($totalDiscountAmount <= 0) {
            return $cart;
        }

        if (!$cart->discounts) {
            $cart->discounts = collect();
        }

        $cart->discounts->push($this);

        $this->addDiscountBreakdown($cart, new \Lunar\Base\ValueObjects\Cart\DiscountBreakdown(
            price: new Price($totalDiscountAmount, $cart->currency, 1),
            lines: $affectedLines,
            discount: $this->discount,
        ));

        return $cart;
    }
}
