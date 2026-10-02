<?php

namespace App\Payments;

use App\Models\Setting;
use App\Payments\Contracts\PaymentGatewayInterface;
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
                'enabled' => $available && $adminEnabled,
            ];

            if ($gateway->method() === 'card') {
                $card = $definition;
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
