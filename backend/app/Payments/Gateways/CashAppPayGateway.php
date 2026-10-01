<?php

namespace App\Payments\Gateways;

class CashAppPayGateway extends StripeAltMethodGateway
{
    public function method(): string
    {
        return 'cashapp';
    }

    public function label(): string
    {
        return 'Cash App Pay';
    }

    protected function minAmountMinor(): ?int
    {
        // Stripe US/USD Cash App Pay minimum is $0.50; no business-level maximum.
        // Source: https://docs.stripe.com/payments/cash-app-pay.md
        return 50;
    }

    protected function maxAmountMinor(): ?int
    {
        return null;
    }
}
