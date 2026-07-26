<?php

namespace App\Payments\Gateways;

use App\Payments\Contracts\PaymentGatewayInterface;
use App\Payments\Data\PaymentPreparation;
use App\Services\PayPalService;

class PayPalGateway implements PaymentGatewayInterface
{
    public function __construct(
        private readonly PayPalService $payPalService,
    ) {}

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
        $paymentContext = (array) ($payload['payment_context'] ?? []);

        return new PaymentPreparation(
            method: $this->method(),
            label: $this->label(),
            gateway: 'paypal',
            collectionType: 'popup',
            paymentStatus: 'pending',
            instructions: 'PayPal order created — approve in the popup to complete payment.',
            meta: [
                'payment_provider_mode' => $this->payPalService->isConfigured() ? 'configured' : 'placeholder',
                'paypal_order_id' => $paymentContext['paypal_order_id'] ?? null,
            ],
        );
    }

    public function definition(): array
    {
        $configured = $this->payPalService->isConfigured();

        return [
            'method' => $this->method(),
            'label' => $this->label(),
            'gateway' => 'paypal',
            'collection' => 'popup',
            'description' => 'Pay with your PayPal balance, bank account, or linked card.',
            'enabled' => true,
            'mode' => $configured ? 'configured' : 'placeholder',
            'brands' => ['paypal'],
            'client_id' => $configured ? $this->payPalService->clientId() : null,
        ];
    }
}
