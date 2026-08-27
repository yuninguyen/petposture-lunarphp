<?php

namespace App\Services;

use App\Models\CheckoutSession;
use Illuminate\Support\Arr;
use Illuminate\Support\Str;
use Lunar\Models\Contracts\Order;
use Lunar\Models\Discount;

class CheckoutSessionService
{
    public function __construct(
        private readonly CheckoutService $checkoutService,
        private readonly StripePaymentIntentService $stripePaymentIntentService,
        private readonly ShippingService $shippingService,
    ) {}

    public function upsert(?string $token, array $payload, ?int $userId = null): CheckoutSession
    {
        $session = $this->resolve($token, $userId);
        $guestProof = null;

        if (! $session->exists && ! $userId) {
            $guestProof = Str::random(64);
            $session->guest_proof_hash = hash('sha256', $guestProof);
        }

        $mergedPayload = array_replace_recursive($session->payload ?? [], $payload);

        $session->fill([
            'user_id' => $userId ?: $session->user_id,
            'payload' => $mergedPayload,
            'currency' => strtoupper((string) ($mergedPayload['currency'] ?? $session->currency ?? 'USD')),
            'status' => $this->resolveStatus($mergedPayload, $session->status),
            'totals' => $this->buildTotals($mergedPayload),
            'expires_at' => now()->addHours(24),
        ]);

        $session->save();

        $freshSession = $session->fresh();
        $freshSession->guestProof = $guestProof;

        return $freshSession;
    }

    public function getByToken(string $token): CheckoutSession
    {
        $session = CheckoutSession::query()->where('token', $token)->firstOrFail();

        if ($session->expires_at?->isPast()) {
            if ($session->status !== 'expired') {
                $session->update(['status' => 'expired']);
            }

            abort(410, 'Checkout session has expired.');
        }

        return $session;
    }

    public function proofCookieName(string $token): string
    {
        return 'checkout_session_proof_'.substr(hash('sha256', $token), 0, 16);
    }

    public function signGuestProof(string $guestProof): string
    {
        $signature = hash_hmac('sha256', $guestProof, app('encrypter')->getKey());

        return $guestProof.'.'.$signature;
    }

    public function isOwnedByContext(CheckoutSession $session, ?int $userId, ?string $signedGuestProof): bool
    {
        if ($session->user_id) {
            return $userId !== null && $session->user_id === $userId;
        }

        if (! $session->guest_proof_hash || ! $signedGuestProof) {
            return false;
        }

        [$guestProof, $signature] = array_pad(explode('.', $signedGuestProof, 2), 2, null);

        if (! $signature) {
            return false;
        }

        $expectedSignature = hash_hmac('sha256', $guestProof, app('encrypter')->getKey());

        return hash_equals($expectedSignature, $signature)
            && hash_equals($session->guest_proof_hash, hash('sha256', $guestProof));
    }

    public function preparePaymentIntent(CheckoutSession $session): array
    {
        $payload = (array) ($session->payload ?? []);
        $totals = $this->buildTotals($payload);

        $intent = $this->stripePaymentIntentService->create([
            'amount' => (int) ($totals['total_minor'] ?? 0),
            'currency' => strtolower((string) ($payload['currency'] ?? $session->currency ?? 'usd')),
            'email' => (string) Arr::get($payload, 'shipping.email', ''),
        ]);

        $paymentContext = [
            'intent_id' => $intent['intent_id'],
            'client_secret' => $intent['client_secret'],
            'status' => $intent['status'],
        ];

        $payload['payment_method'] ??= 'card';
        $payload['payment_context'] = $paymentContext;

        $session->update([
            'payload' => $payload,
            'totals' => $totals,
            'status' => 'payment',
            'payment_intent_id' => $intent['intent_id'],
            'payment_client_secret' => $intent['client_secret'],
            'currency' => strtoupper((string) $intent['currency']),
            'expires_at' => now()->addHours(24),
        ]);

        return $intent;
    }

    public function confirm(CheckoutSession $session): Order
    {
        $order = $this->checkoutService->placeOrder((array) ($session->payload ?? []), $session->user_id);

        $session->update([
            'status' => 'completed',
            'order_reference' => $order->reference,
            'expires_at' => now()->addDays(7),
        ]);

        return $order;
    }

    private function resolve(?string $token, ?int $userId): CheckoutSession
    {
        if ($token) {
            $existing = CheckoutSession::query()->where('token', $token)->first();
            if ($existing) {
                return $existing;
            }
        }

        return new CheckoutSession([
            'token' => $token ?: (string) Str::uuid(),
            'user_id' => $userId,
            'status' => 'cart',
            'payload' => [],
            'totals' => [],
            'currency' => 'USD',
            'expires_at' => now()->addHours(24),
        ]);
    }

    private function resolveStatus(array $payload, ?string $currentStatus): string
    {
        if (! empty($payload['payment_context'])) {
            return 'confirm';
        }

        if (! empty($payload['payment_method'])) {
            return 'payment';
        }

        if (! empty($payload['shipping_method'])) {
            return 'shipping';
        }

        if (! empty($payload['shipping']['line_one'] ?? null)) {
            return 'address';
        }

        if (! empty($payload['items'] ?? [])) {
            return 'cart';
        }

        return $currentStatus ?: 'cart';
    }

    private function buildTotals(array $payload): array
    {
        $items = (array) ($payload['items'] ?? []);

        if ($items === []) {
            return [
                'subtotal_minor' => 0,
                'discount_minor' => 0,
                'tax_minor' => 0,
                'shipping_minor' => 0,
                'total_minor' => 0,
            ];
        }

        $couponCode = $payload['coupon_code'] ?? null;

        $totalMinor = $this->checkoutService->calculateTotal(
            $items,
            $couponCode,
            $payload['shipping'] ?? null,
            $payload['shipping_method'] ?? null,
        );

        $subtotalMinor = $this->checkoutService->subtotalFor($items);

        $isFreeShipping = false;
        if ($couponCode) {
            $discount = Discount::active()->where('coupon', $couponCode)->first();
            $isFreeShipping = (bool) ($discount?->data['free_shipping'] ?? false);
        }

        $shippingMinor = $this->shippingService->rateFor(
            $payload['shipping_method'] ?? 'standard',
            $subtotalMinor,
            $isFreeShipping,
        );

        return [
            'subtotal_minor' => null,
            'discount_minor' => null,
            'tax_minor' => null,
            'shipping_minor' => $shippingMinor,
            'total_minor' => $totalMinor,
        ];
    }
}
