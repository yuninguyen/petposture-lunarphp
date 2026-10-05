<?php

namespace App\Payments;

use App\Models\Setting;
use App\Payments\Contracts\PaymentGatewayInterface;
use App\Services\AirwallexPaymentMethodStatusService;
use App\Services\StripePaymentMethodStatusService;
use InvalidArgumentException;

class PaymentGatewayManager
{
    /**
     * Express wallets run on Stripe and are charged as card payments, so they
     * are not gateways of their own — only separately switchable methods.
     */
    public const WALLETS = ['google_pay' => 'Google Pay', 'apple_pay' => 'Apple Pay'];

    /**
     * Wallets that can also be paid through Airwallex (the fallback when Stripe's wallet is off). Like the
     * Stripe wallets they are card payments of the 'airwallex' gateway with a switch of their own,
     * 'airwallex_<wallet>'.
     */
    public const AIRWALLEX_WALLETS = ['google_pay' => 'Google Pay', 'apple_pay' => 'Apple Pay'];

    /**
     * Redirect methods Airwallex can take (the fallback when Stripe's / PayPal's own is off): the order is
     * created first, then the PaymentIntent is confirmed with the method and the shopper is sent to its page.
     * Also 'airwallex' gateway orders, with a switch of their own, 'airwallex_<method>'.
     */
    // Venmo is not here: Airwallex answers it with next_action "call_sdk" (a browser SDK flow), not a redirect.
    public const AIRWALLEX_REDIRECTS = ['klarna' => 'Klarna', 'paypal' => 'PayPal'];

    /** Whether $variant (a payment_context.wallet value) names an Airwallex wallet or redirect method. */
    public static function isAirwallexVariant(?string $variant): bool
    {
        $variant = strtolower(trim((string) $variant));

        return isset(self::AIRWALLEX_WALLETS[$variant]) || isset(self::AIRWALLEX_REDIRECTS[$variant]);
    }

    /**
     * @param  iterable<PaymentGatewayInterface>  $gateways
     */
    public function __construct(
        private readonly iterable $gateways
    ) {}

    public function forMethod(?string $method, ?string $wallet = null): PaymentGatewayInterface
    {
        $requestedMethod = strtolower(trim((string) ($method ?: 'cod')));
        $requestedWallet = strtolower(trim((string) $wallet));
        // A wallet order is governed by the wallet's own switch, not the Credit card one.
        $switch = $requestedMethod === 'card' && isset(self::WALLETS[$requestedWallet]) ? $requestedWallet : $requestedMethod;
        if ($requestedMethod === 'airwallex' && self::isAirwallexVariant($requestedWallet)) {
            $switch = 'airwallex_'.$requestedWallet;
        }
        // An order placed from the Express checkout's PayPal button follows the "PayPal Express" switch, so the
        // PayPal radio can be off while the Express button stays on (and the other way round).
        if ($requestedMethod === 'paypal' && $requestedWallet === 'express') {
            $switch = 'paypal_express';
        }

        foreach ($this->gateways as $gateway) {
            if ($gateway->method() === $requestedMethod) {
                if (! ($gateway->definition()['enabled'] ?? true) || ! $this->adminEnabled($switch) || $this->stripeBlocked($switch)) {
                    throw new InvalidArgumentException("Unsupported payment method [{$switch}].");
                }

                return $gateway;
            }
        }

        throw new InvalidArgumentException("Unsupported payment method [{$requestedMethod}].");
    }

    public function supportedMethods(): array
    {
        $methods = [];
        $card = null;

        foreach ($this->gateways as $gateway) {
            $definition = $gateway->definition();
            $available = $gateway->method() === 'cod' ? true : (bool) ($definition['enabled'] ?? true);
            $stripeStatus = $this->stripeStatus($gateway->method());
            $available = $available && ! $this->stripeBlocked($gateway->method());
            $adminEnabled = $this->adminEnabled($gateway->method());
            $methods[] = [
                ...$definition,
                'available' => $available,
                'admin_enabled' => $adminEnabled,
                'stripe_status' => $stripeStatus,
                // The admin shows what the Airwallex dashboard says about its card, like Stripe's "On in Stripe".
                ...($gateway->method() === 'airwallex' ? ['airwallex_status' => app(AirwallexPaymentMethodStatusService::class)->status('airwallex')] : []),
                'enabled' => $available && $adminEnabled,
            ];

            if ($gateway->method() === 'card') {
                $card = $definition;
            }

            if ($gateway->method() === 'paypal') {
                $adminEnabled = $this->adminEnabled('paypal_express');
                $available = (bool) ($definition['enabled'] ?? true);
                $methods[] = [
                    'method' => 'paypal_express',
                    'label' => 'PayPal Express',
                    'gateway' => 'paypal',
                    'collection' => 'express',
                    'mode' => $definition['mode'] ?? 'placeholder',
                    'brands' => ['paypal'],
                    // The Express button needs the connection details even while the PayPal radio is switched off.
                    'client_id' => $definition['client_id'] ?? null,
                    'environment' => $definition['environment'] ?? null,
                    'available' => $available,
                    'admin_enabled' => $adminEnabled,
                    'stripe_status' => null,
                    'enabled' => $available && $adminEnabled,
                ];
            }

            if ($gateway->method() === 'airwallex') {
                foreach (self::AIRWALLEX_WALLETS + self::AIRWALLEX_REDIRECTS as $wallet => $label) {
                    $adminEnabled = $this->adminEnabled('airwallex_'.$wallet);
                    // What the Airwallex dashboard says ('on'/'off'/'unavailable'/null unknown): off or not offered hides it.
                    $airwallexStatus = app(AirwallexPaymentMethodStatusService::class)->status('airwallex_'.$wallet);
                    $available = (bool) ($definition['enabled'] ?? false) && ! in_array($airwallexStatus, ['off', 'unavailable'], true);
                    $methods[] = [
                        'method' => 'airwallex_'.$wallet,
                        'label' => $label,
                        'gateway' => 'airwallex',
                        'collection' => isset(self::AIRWALLEX_WALLETS[$wallet]) ? 'wallet' : 'redirect_method',
                        'env' => $definition['env'] ?? null,
                        'merchant_id' => config('services.airwallex.merchant_id'),
                        'mode' => $definition['mode'] ?? 'placeholder',
                        'brands' => [$wallet],
                        'available' => $available,
                        'admin_enabled' => $adminEnabled,
                        'stripe_status' => null,
                        'airwallex_status' => $airwallexStatus,
                        // Google Pay needs our Airwallex account id (gatewayMerchantId); Apple Pay on the web is validated by
                        // Airwallex with its own certificates, so it only needs the domain registered in their dashboard.
                        'enabled' => $available && $adminEnabled && ($wallet !== 'google_pay' || filled(config('services.airwallex.merchant_id'))),
                    ];
                }
            }
        }

        if ($card !== null) {
            foreach (self::WALLETS as $wallet => $label) {
                $stripeStatus = $this->stripeStatus($wallet);
                $available = ($card['mode'] ?? null) === 'configured' && ! $this->stripeBlocked($wallet);
                $adminEnabled = $this->adminEnabled($wallet);
                $methods[] = [
                    'method' => $wallet,
                    'label' => $label,
                    'gateway' => 'stripe',
                    'collection' => 'wallet',
                    'mode' => $card['mode'] ?? 'placeholder',
                    'brands' => [$wallet],
                    'publishable_key' => $card['publishable_key'] ?? null,
                    'available' => $available,
                    'admin_enabled' => $adminEnabled,
                    'stripe_status' => $stripeStatus,
                    'enabled' => $available && $adminEnabled,
                ];
            }
        }

        return $methods;
    }

    /** What the Stripe dashboard says about a Stripe-powered method ('on'/'off'/'unavailable'), or null if unknown/not Stripe. */
    private function stripeStatus(string $method): ?string
    {
        return isset(StripePaymentMethodStatusService::STRIPE_KEYS[$method])
            ? app(StripePaymentMethodStatusService::class)->status($method)
            : null;
    }

    private function stripeBlocked(string $method): bool
    {
        return isset(StripePaymentMethodStatusService::STRIPE_KEYS[$method])
            && app(StripePaymentMethodStatusService::class)->isBlocked($method);
    }

    private function adminEnabled(string $method): bool
    {
        $key = $method === 'cod' ? 'cod_enabled' : "payment_method_{$method}_enabled";

        return (bool) Setting::get($key, true);
    }
}
