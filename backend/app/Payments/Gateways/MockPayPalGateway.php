<?php

namespace App\Payments\Gateways;

use App\Payments\Contracts\PaymentGatewayInterface;
use App\Payments\Data\PaymentPreparation;

class MockPayPalGateway implements PaymentGatewayInterface
{
    public function method(): string
    {
        return 'paypal';
    }

    public function label(): string
    {
        return 'PayPal';
    }

    public function prepare(array $payload = []): PaymentPreparation
    {
        return new PaymentPreparation(
            method: $this->method(),
            label: $this->label(),
            gateway: 'mock-paypal',
            collectionType: 'redirect',
            paymentStatus: 'pending',
            instructions: 'PayPal redirect is not connected yet. Treat this as a placeholder checkout method.',
        );
    }

    public function definition(): array
    {
        return [
            'method' => $this->method(),
            'label' => $this->label(),
            'gateway' => 'paypal',
            'collection' => 'redirect',
            'description' => 'Redirect customers to PayPal for approval before returning to the store.',
            'enabled' => true,
            'mode' => 'placeholder',
            'brands' => ['paypal'],
        ];
    }
}
