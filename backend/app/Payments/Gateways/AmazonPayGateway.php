<?php

namespace App\Payments\Gateways;

class AmazonPayGateway extends StripeAltMethodGateway
{
    public function method(): string
    {
        return 'amazon_pay';
    }

    public function label(): string
    {
        return 'Amazon Pay';
    }

    protected function minAmountMinor(): ?int
    {
        // Verified against Stripe in sandbox: USD amounts below $0.50 are rejected.
        return 50;
    }

    protected function maxAmountMinor(): ?int
    {
        // No method-specific cap beyond Stripe's general maximum.
        return null;
    }
}
