<?php

namespace App\Payments\Gateways;

use App\Payments\Contracts\PaymentGatewayInterface;
use App\Payments\Data\PaymentPreparation;
use App\Services\PingPongService;

class PingPongGateway implements PaymentGatewayInterface
{
    public function __construct(
        private readonly PingPongService $pingPongService,
    ) {}

    public function method(): string
    {
        return 'pingpong';
    }

    public function label(): string
    {
        return 'PingPong';
    }

    public function prepare(array $payload = []): PaymentPreparation
    {
        $paymentContext = (array) ($payload['payment_context'] ?? []);

        return new PaymentPreparation(
            method: $this->method(),
            label: $this->label(),
            gateway: 'pingpong',
            collectionType: 'redirect',
            paymentStatus: 'pending',
            instructions: 'You will be redirected to PingPong to complete payment.',
            meta: [
                'payment_provider_mode' => $this->pingPongService->isConfigured() ? 'configured' : 'placeholder',
                'pingpong_session_id' => $paymentContext['session_id'] ?? null,
            ],
        );
    }

    public function definition(): array
    {
        $configured = $this->pingPongService->isConfigured();

        return [
            'method' => $this->method(),
            'label' => $this->label(),
            'gateway' => 'pingpong',
            'collection' => 'redirect',
            'description' => 'Pay securely through PingPong.',
            'enabled' => true,
            'mode' => $configured ? 'configured' : 'placeholder',
            'brands' => ['pingpong'],
        ];
    }
}
