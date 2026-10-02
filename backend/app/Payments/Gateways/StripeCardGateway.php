<?php

namespace App\Payments\Gateways;

use App\Models\Setting;
use App\Payments\Contracts\PaymentGatewayInterface;
use App\Payments\Data\PaymentPreparation;
use App\Payments\PaymentGatewayManager;
use Illuminate\Support\Facades\Cache;

class StripeCardGateway implements PaymentGatewayInterface
{
    /** Card brand logos the checkout can show, in display order. */
    public const BRANDS = ['visa', 'mastercard', 'amex', 'discover', 'diners', 'elo', 'jcb', 'unionpay'];

    /**
     * Brands whose logos the admin has switched on (all of them until the admin
     * saves a choice). Display only — Stripe's own settings decide what is accepted.
     *
     * @return array<int, string>
     */
    public static function enabledBrands(): array
    {
        $stored = Setting::get('payment_card_brands');

        return is_array($stored) ? array_values(array_intersect(self::BRANDS, $stored)) : self::BRANDS;
    }

    public function method(): string
    {
        return 'card';
    }

    public function label(): string
    {
        return 'Card';
    }

    private function stripeKey(): string
    {
        return Cache::remember('stripe_key', 300, fn () => Setting::get('stripe_key') ?: (string) config('services.stripe.key')
        );
    }

    private function stripeSecret(): string
    {
        return Cache::remember('stripe_secret', 300, fn () => Setting::get('stripe_secret') ?: (string) config('services.stripe.secret')
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
                // Express wallet orders are card payments at Stripe; remember which wallet was used.
                'payment_wallet' => is_string($paymentContext['wallet'] ?? null) && isset(PaymentGatewayManager::WALLETS[$paymentContext['wallet']]) ? $paymentContext['wallet'] : null,
            ],
        );
    }

    public function definition(): array
    {
        $configured = filled($this->stripeKey()) && filled($this->stripeSecret());

        return [
            'method' => $this->method(),
            // Distinct from label(), which stays 'Card' for order meta/admin
            // display -- this is the checkout page's own copy.
            'label' => 'Credit or Debit Card',
            'gateway' => 'stripe',
            'collection' => 'direct',
            'enabled' => true,
            'mode' => $configured ? 'configured' : 'placeholder',
            'brands' => self::enabledBrands(),
            'publishable_key' => $this->stripeKey(),
        ];
    }
}
