<?php

namespace App\Payments\Gateways;

class AchDebitGateway extends StripeAltMethodGateway
{
    public function method(): string
    {
        return 'ach_debit';
    }

    public function label(): string
    {
        return 'ACH Direct Debit';
    }

    protected function minAmountMinor(): ?int
    {
        // Stripe's minimum for US bank account (ACH) payments is $0.50.
        return 50;
    }

    protected function maxAmountMinor(): ?int
    {
        // No method-specific cap beyond Stripe's general maximum.
        return null;
    }
}
