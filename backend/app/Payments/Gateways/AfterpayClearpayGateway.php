<?php

namespace App\Payments\Gateways;

class AfterpayClearpayGateway extends StripeAltMethodGateway
{
    public function method(): string
    {
        return 'afterpay_clearpay';
    }

    public function label(): string
    {
        return 'Afterpay / Clearpay';
    }

    protected function minAmountMinor(): ?int
    {
        // Stripe US/USD Afterpay / Clearpay accepts $1 to $4,000.
        // Source: https://docs.stripe.com/payments/afterpay-clearpay.md
        return 100;
    }

    protected function maxAmountMinor(): ?int
    {
        return 400_000;
    }
}
