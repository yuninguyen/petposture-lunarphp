<?php

namespace App\Payments\Gateways;

use App\Models\Setting;
use App\Payments\Contracts\PaymentGatewayInterface;
use App\Payments\Data\PaymentPreparation;
use Illuminate\Support\Facades\Cache;

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

    private function stripeKey(): string
    {
        return Cache::remember('stripe_key', 300, fn () =>
            Setting::get('stripe_key') ?: (string) config('services.stripe.key')
        );
    }

    private function stripeSecret(): string
    {
        return Cache::remember('stripe_secret', 300, fn () =>
            Setting::get('stripe_secret') ?: (string) config('services.stripe.secret')
        );
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
                'payment_provider_mode' => $this->stripeSecret() ? 'configured' : 'placeholder',
                'payment_intent_id' => $paymentContext['intent_id'] ?? null,
                'payment_client_secret' => $paymentContext['client_secret'] ?? null,
                'payment_intent_status' => $paymentContext['status'] ?? null,
            ],
        );
    }

    public function definition(): array
    {
        $configured = filled($this->stripeKey()) && filled($this->stripeSecret());

        return [
            'method' => $this->method(),
            'label' => $this->label(),
            'gateway' => 'stripe',
            'collection' => 'direct',
            'description' => 'Pay securely with Visa, Mastercard, Amex, and other major cards.',
            'enabled' => true,
            'mode' => $configured ? 'configured' : 'placeholder',
            'brands' => ['visa', 'mastercard', 'amex'],
            'publishable_key' => $this->stripeKey(),
        ];
    }
}
