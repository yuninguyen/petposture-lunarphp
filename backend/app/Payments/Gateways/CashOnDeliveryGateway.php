<?php

namespace App\Payments\Gateways;

use App\Payments\Contracts\PaymentGatewayInterface;
use App\Payments\Data\PaymentPreparation;

class CashOnDeliveryGateway implements PaymentGatewayInterface
{
    public function method(): string
    {
        return 'cod';
    }

    public function label(): string
    {
        return 'Cash on delivery';
    }

    public function prepare(array $payload = []): PaymentPreparation
    {
        return new PaymentPreparation(
            method: $this->method(),
            label: $this->label(),
            gateway: 'manual-offline',
            collectionType: 'offline',
            paymentStatus: 'pending',
            instructions: 'Collect payment when the shipment is delivered.',
        );
    }

    public function definition(): array
    {
        return [
            'method' => $this->method(),
            'label' => $this->label(),
            'gateway' => 'manual-offline',
            'collection' => 'offline',
            'description' => 'Use this only for testing or offline settlement workflows.',
            'enabled' => true,
            'mode' => 'manual',
            'brands' => [],
        ];
    }
}
