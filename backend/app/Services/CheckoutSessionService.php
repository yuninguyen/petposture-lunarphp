<?php

namespace App\Services;

use App\Data\CheckoutSessionPayload;
use App\Models\CheckoutSession;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Lunar\Models\Contracts\Order;
use Lunar\Models\Order as LunarOrder;

class CheckoutSessionService
{
    public function __construct(
        private readonly CheckoutService $checkoutService,
        private readonly StripePaymentIntentService $stripePaymentIntentService,
    ) {}

    public function upsert(?string $token, array $payload, ?int $userId = null): CheckoutSession
    {
        $session = $this->resolve($token, $userId);
        $guestProof = null;

        if ($session->exists) {
            abort_unless(
                $session->status === 'open',
                409,
                'Checkout session can no longer be updated.',
            );
        }

        if (! $session->exists && ! $userId) {
            $guestProof = Str::random(64);
            $session->guest_proof_hash = hash('sha256', $guestProof);
        }

        $mergedPayload = CheckoutSessionPayload::sanitize(
            array_replace_recursive($session->payload ?? [], $payload),
        );
        $totals = $this->buildTotals($mergedPayload);

        $session->fill([
            'user_id' => $userId ?: $session->user_id,
            'payload' => $mergedPayload,
            'currency' => (string) ($totals['currency'] ?? 'USD'),
            'status' => $session->status ?: 'open',
            'totals' => $totals,
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

    public function getForConfirmation(string $token): CheckoutSession
    {
        $session = CheckoutSession::query()
            ->where('token', $token)
            ->orWhere('previous_token_hash', hash('sha256', $token))
            ->firstOrFail();

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

    public function preparePaymentIntent(CheckoutSession $session, string $idempotencyKey): array
    {
        return DB::transaction(function () use ($session, $idempotencyKey): array {
            $lockedSession = CheckoutSession::query()->lockForUpdate()->findOrFail($session->id);
            $keyHash = hash('sha256', $idempotencyKey);

            if ($lockedSession->payment_intent_idempotency_key_hash) {
                abort_unless(
                    hash_equals($lockedSession->payment_intent_idempotency_key_hash, $keyHash),
                    409,
                    'Checkout payment intent has already been prepared.',
                );

                return (array) $lockedSession->payment_intent_response;
            }

            abort_unless(
                $lockedSession->status === 'open',
                409,
                'Checkout session is not open for payment preparation.',
            );

            $payload = (array) ($lockedSession->payload ?? []);
            $totals = $this->buildTotals($payload);

            $intent = $this->stripePaymentIntentService->create([
                'amount' => (int) ($totals['total_minor'] ?? 0),
                'currency' => strtolower((string) ($payload['currency'] ?? $lockedSession->currency ?? 'usd')),
                'email' => (string) Arr::get($payload, 'shipping.email', ''),
                'idempotency_key' => "checkout-session:{$lockedSession->id}:payment-intent:{$keyHash}",
            ]);

            $paymentContext = [
                'intent_id' => $intent['intent_id'],
                'client_secret' => $intent['client_secret'],
                'status' => $intent['status'],
            ];

            $payload['payment_method'] ??= 'card';
            $payload['payment_context'] = $paymentContext;

            $lockedSession->update([
                'payload' => $payload,
                'totals' => $totals,
                'status' => $intent['status'] === 'succeeded' ? 'paid' : 'payment_pending',
                'payment_intent_id' => $intent['intent_id'],
                'payment_client_secret' => $intent['client_secret'],
                'payment_intent_idempotency_key_hash' => $keyHash,
                'payment_intent_response' => $intent,
                'currency' => strtoupper((string) $intent['currency']),
                'expires_at' => now()->addHours(24),
            ]);

            return $intent;
        });
    }

    public function confirm(CheckoutSession $session, string $idempotencyKey): Order
    {
        return DB::transaction(function () use ($session, $idempotencyKey): Order {
            $lockedSession = CheckoutSession::query()->lockForUpdate()->findOrFail($session->id);
            $keyHash = hash('sha256', $idempotencyKey);

            if ($lockedSession->status === 'consumed') {
                abort_unless(
                    $lockedSession->confirm_idempotency_key_hash
                        && hash_equals($lockedSession->confirm_idempotency_key_hash, $keyHash),
                    409,
                    'Checkout session has already been consumed.',
                );

                return LunarOrder::query()
                    ->where('reference', $lockedSession->order_reference)
                    ->firstOrFail();
            }

            abort_unless(
                in_array($lockedSession->status, ['payment_pending', 'paid'], true),
                409,
                'Checkout session is not ready for confirmation.',
            );

            if ($lockedSession->status === 'payment_pending') {
                abort_unless(
                    filled($lockedSession->payment_intent_id),
                    409,
                    'Checkout session has no payment intent to verify.',
                );

                $providerIntent = $this->stripePaymentIntentService->retrieve($lockedSession->payment_intent_id);

                abort_unless(
                    ($providerIntent['status'] ?? null) === 'succeeded',
                    409,
                    'Payment has not been confirmed by the provider.',
                );

                $lockedSession->update(['status' => 'paid']);
            }

            $order = $this->checkoutService->placeOrder(
                (array) ($lockedSession->payload ?? []),
                $lockedSession->user_id,
            );
            $oldToken = $lockedSession->token;

            $lockedSession->update([
                'status' => 'confirmed',
                'order_reference' => $order->reference,
                'confirm_idempotency_key_hash' => $keyHash,
                'expires_at' => now()->addDays(7),
            ]);
            $lockedSession->update([
                'status' => 'consumed',
                'previous_token_hash' => hash('sha256', $oldToken),
                'token' => (string) Str::uuid(),
            ]);

            return $order;
        });
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
            'status' => 'open',
            'payload' => [],
            'totals' => [],
            'currency' => 'USD',
            'expires_at' => now()->addHours(24),
        ]);
    }

    private function buildTotals(array $payload): array
    {
        return $this->checkoutService->calculateTotals(
            (array) ($payload['items'] ?? []),
            $payload['coupon_code'] ?? null,
            $payload['shipping'] ?? null,
            $payload['shipping_method'] ?? null,
        );
    }
}
