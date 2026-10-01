<?php

namespace App\Payments\Gateways;

class AffirmGateway extends StripeAltMethodGateway
{
    public function method(): string
    {
        return 'affirm';
    }

    public function label(): string
    {
        return 'Affirm - Pay Over Time';
    }

    protected function minAmountMinor(): ?int
    {
        // Stripe US/USD Affirm options span $35 to $30,000.
        // Source: https://docs.stripe.com/payments/affirm.md
        return 3500;
    }

    protected function maxAmountMinor(): ?int
    {
        return 3_000_000;
    }
}
