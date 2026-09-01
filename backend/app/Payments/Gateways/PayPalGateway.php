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
            collectionType: 'redirect',
            paymentStatus: 'pending',
            instructions: 'PayPal order created — approve on PayPal to complete payment.',
            meta: [
                'payment_provider_mode' => $this->payPalService->isConfigured() ? 'configured' : 'placeholder',
                'paypal_order_id' => $paymentContext['paypal_order_id'] ?? null,
                'paypal_session_id' => $paymentContext['session_id'] ?? null,
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
            'collection' => 'redirect',
            'description' => 'Pay with your PayPal balance, bank account, or linked card.',
            'enabled' => true,
            'mode' => $configured ? 'configured' : 'placeholder',
            'brands' => ['paypal'],
            'client_id' => $configured ? $this->payPalService->clientId() : null,
        ];
    }
}
