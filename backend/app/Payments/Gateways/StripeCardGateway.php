<?php

namespace App\Payments\Gateways;

use App\Payments\Contracts\PaymentGatewayInterface;
use App\Payments\Data\PaymentPreparation;

class StripeCardGateway implements PaymentGatewayInterface
{
    public function method(): string
    {
        return 'card';
    }

    public function label(): string
    {
        return 'Credit card';
    }

    public function prepare(array $payload = []): PaymentPreparation
    {
        $paymentContext = (array) ($payload['payment_context'] ?? []);

        return new PaymentPreparation(
            method: $this->method(),
            label: $this->label(),
            gateway: 'stripe',
            collectionType: 'direct',
            paymentStatus: 'pending',
            instructions: 'Stripe card capture is scaffolded, but the live payment intent flow is not connected yet.',
            meta: [
                'payment_provider_mode' => config('services.stripe.secret') ? 'configured' : 'placeholder',
                'payment_intent_id' => $paymentContext['intent_id'] ?? null,
                'payment_client_secret' => $paymentContext['client_secret'] ?? null,
                'payment_intent_status' => $paymentContext['status'] ?? null,
            ],
        );
    }

    public function definition(): array
    {
        $configured = filled(config('services.stripe.key')) && filled(config('services.stripe.secret'));

        return [
            'method' => $this->method(),
            'label' => $this->label(),
            'gateway' => 'stripe',
            'collection' => 'direct',
            'description' => 'Pay securely with Visa, Mastercard, Amex, and other major cards.',
            'enabled' => true,
            'mode' => $configured ? 'configured' : 'placeholder',
            'brands' => ['visa', 'mastercard', 'amex'],
            'publishable_key' => config('services.stripe.key'),
        ];
    }
}
