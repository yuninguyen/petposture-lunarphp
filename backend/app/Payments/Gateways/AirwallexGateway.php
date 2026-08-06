<?php

namespace App\Payments\Gateways;

use App\Payments\Contracts\PaymentGatewayInterface;
use App\Payments\Data\PaymentPreparation;
use App\Services\AirwallexService;

class AirwallexGateway implements PaymentGatewayInterface
{
    public function __construct(
        private readonly AirwallexService $airwallexService,
    ) {}

    public function method(): string
    {
        return 'airwallex';
    }

    public function label(): string
    {
        return 'Airwallex';
    }

    public function prepare(array $payload = []): PaymentPreparation
    {
        $paymentContext = (array) ($payload['payment_context'] ?? []);

        return new PaymentPreparation(
            method: $this->method(),
            label: $this->label(),
            gateway: 'airwallex',
            collectionType: 'redirect',
            paymentStatus: 'pending',
            instructions: 'You will be redirected to Airwallex to complete payment.',
            meta: [
                'payment_provider_mode' => $this->airwallexService->isConfigured() ? 'configured' : 'placeholder',
                'airwallex_session_id' => $paymentContext['session_id'] ?? null,
            ],
        );
    }

    public function definition(): array
    {
        $configured = $this->airwallexService->isConfigured();

        return [
            'method' => $this->method(),
            'label' => $this->label(),
            'gateway' => 'airwallex',
            'collection' => 'redirect',
            'description' => 'Pay via card, Apple Pay, Google Pay, and more through Airwallex.',
            'enabled' => true,
            'mode' => $configured ? 'configured' : 'placeholder',
            'brands' => ['airwallex'],
        ];
    }
}
