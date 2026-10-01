<?php

namespace App\Payments\Gateways;

class KlarnaGateway extends StripeAltMethodGateway
{
    public function method(): string
    {
        return 'klarna';
    }

    public function label(): string
    {
        return 'Pay with Klarna';
    }

    protected function minAmountMinor(): ?int
    {
        // Stripe US/USD Klarna Pay in full supports amounts from $0.
        // Source: https://docs.stripe.com/payments/klarna.md
        return 0;
    }

    protected function maxAmountMinor(): ?int
    {
        return 400_000;
    }
}
