<?php

namespace App\Payments\Gateways;

use App\Models\Setting;
use App\Payments\Contracts\PaymentGatewayInterface;
use App\Payments\Data\PaymentPreparation;
use Illuminate\Support\Facades\Cache;

abstract class StripeAltMethodGateway implements PaymentGatewayInterface
{
    abstract protected function minAmountMinor(): ?int;

    abstract protected function maxAmountMinor(): ?int;

    private function stripeKey(): string
    {
        return Cache::remember('stripe_key', 300, fn () => Setting::get('stripe_key') ?: (string) config('services.stripe.key'));
    }

    private function stripeSecret(): string
    {
        return Cache::remember('stripe_secret', 300, fn () => Setting::get('stripe_secret') ?: (string) config('services.stripe.secret'));
    }

    private function stripeConfigured(): bool
    {
        return filled($this->stripeKey()) && filled($this->stripeSecret());
    }

    public function prepare(array $payload = []): PaymentPreparation
    {
        $paymentContext = (array) ($payload['payment_context'] ?? []);

        return new PaymentPreparation(
            method: $this->method(),
            label: $this->label(),
            gateway: 'stripe',
            collectionType: 'redirect',
            paymentStatus: 'pending',
            meta: [
                'payment_provider_mode' => $this->stripeConfigured() ? 'configured' : 'placeholder',
                'payment_intent_id' => $paymentContext['intent_id'] ?? null,
                'stripe_session_id' => $paymentContext['session_id'] ?? null,
            ],
        );
    }

    public function definition(): array
    {
        $configured = $this->stripeConfigured();
        $allowlisted = in_array($this->method(), (array) config('services.stripe.alt_methods', []), true);

        return [
            'method' => $this->method(),
            'label' => $this->label(),
            'gateway' => 'stripe',
            'collection' => 'redirect',
            'enabled' => $allowlisted && $configured,
            'mode' => $configured ? 'configured' : 'placeholder',
            'brands' => [$this->method()],
            'min_amount_minor' => $this->minAmountMinor(),
            'max_amount_minor' => $this->maxAmountMinor(),
            'currency' => 'usd',
            'publishable_key' => $this->stripeKey(),
        ];
    }
}
