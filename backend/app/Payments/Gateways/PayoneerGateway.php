<?php

namespace App\Payments\Gateways;

use App\Payments\Contracts\PaymentGatewayInterface;
use App\Payments\Data\PaymentPreparation;
use App\Services\PayoneerService;

class PayoneerGateway implements PaymentGatewayInterface
{
    public function __construct(
        private readonly PayoneerService $payoneerService,
    ) {}

    public function method(): string
    {
        return 'payoneer';
    }

    public function label(): string
    {
        return 'Payoneer';
    }

    public function prepare(array $payload = []): PaymentPreparation
    {
        $paymentContext = (array) ($payload['payment_context'] ?? []);

        return new PaymentPreparation(
            method: $this->method(),
            label: $this->label(),
            gateway: 'payoneer',
            collectionType: 'redirect',
            paymentStatus: 'pending',
            instructions: 'You will be redirected to Payoneer Checkout to complete payment.',
            meta: [
                'payment_provider_mode' => $this->payoneerService->isConfigured() ? 'configured' : 'placeholder',
                'payoneer_session_id' => $paymentContext['session_id'] ?? null,
            ],
        );
    }

    public function definition(): array
    {
        $configured = $this->payoneerService->isConfigured();

        return [
            'method' => $this->method(),
            'label' => $this->label(),
            'gateway' => 'payoneer',
            'collection' => 'redirect',
            'description' => 'Pay securely through Payoneer Checkout.',
            'enabled' => true,
            'mode' => $configured ? 'configured' : 'placeholder',
            'brands' => ['payoneer'],
        ];
    }
}
