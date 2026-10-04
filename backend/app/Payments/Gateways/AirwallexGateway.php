<?php

namespace App\Payments\Gateways;

use App\Models\Setting;
use App\Payments\Contracts\PaymentGatewayInterface;
use App\Payments\Data\PaymentPreparation;
use App\Payments\PaymentGatewayManager;
use App\Services\AirwallexService;

class AirwallexGateway implements PaymentGatewayInterface
{
    /** Card brand logos the checkout can show, in display order (the same set as the Stripe card). */
    public const BRANDS = StripeCardGateway::BRANDS;

    /**
     * Brands whose logos the admin has switched on for the Airwallex card (all of them until the admin saves a
     * choice). Display only — the Airwallex account decides which cards are accepted.
     *
     * @return array<int, string>
     */
    public static function enabledBrands(): array
    {
        $stored = Setting::get('payment_card_brands_airwallex');

        return is_array($stored) ? array_values(array_intersect(self::BRANDS, $stored)) : self::BRANDS;
    }

    public function __construct(
        private readonly AirwallexService $airwallexService,
    ) {}

    public function method(): string
    {
        return 'airwallex';
    }

    public function label(): string
    {
        return 'Credit or Debit Card (Airwallex)';
    }

    public function prepare(array $payload = []): PaymentPreparation
    {
        $paymentContext = (array) ($payload['payment_context'] ?? []);

        return new PaymentPreparation(
            method: $this->method(),
            // Customers see a card payment, exactly like Stripe's card orders (the gateway stays Airwallex).
            label: 'Card',
            gateway: 'airwallex',
            collectionType: 'redirect',
            paymentStatus: 'pending',
            instructions: 'Pay by card through Airwallex.',
            meta: [
                'payment_provider_mode' => $this->airwallexService->isConfigured() ? 'configured' : 'placeholder',
                'airwallex_session_id' => $paymentContext['session_id'] ?? null,
                'airwallex_intent_id' => $paymentContext['intent_id'] ?? null,
                // A Google Pay button order is still a card payment at Airwallex; remember which wallet was used.
                'payment_wallet' => is_string($paymentContext['wallet'] ?? null) && isset(PaymentGatewayManager::AIRWALLEX_WALLETS[$paymentContext['wallet']]) ? $paymentContext['wallet'] : null,
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
            'description' => 'Pay by card through Airwallex.',
            // Airwallex.js environment ('demo' or 'prod'); the card fields are mounted before any intent exists.
            'env' => $this->airwallexService->sdkEnvironment(),
            // Off until AIRWALLEX_CHECKOUT_ENABLED is set, like the Stripe method allowlist.
            'enabled' => $configured && (bool) config('services.airwallex.checkout_enabled', false),
            'mode' => $configured ? 'configured' : 'placeholder',
            'brands' => self::enabledBrands(),
        ];
    }
}
