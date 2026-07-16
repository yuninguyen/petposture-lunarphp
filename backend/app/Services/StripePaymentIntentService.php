<?php

namespace App\Services;

use App\Models\Setting;
use App\Models\StripeWebhookEvent;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Lunar\Models\Order;
use RuntimeException;

class StripePaymentIntentService
{
    public function __construct(
        private readonly OrderOperationsService $orderOperationsService,
        private readonly OrderEventService $orderEventService,
    ) {
    }

    private function stripeSecret(): string
    {
        return Cache::remember('stripe_secret', 300, fn () =>
            Setting::get('stripe_secret') ?: (string) config('services.stripe.secret')
        );
    }

    private function stripeKey(): string
    {
        return Cache::remember('stripe_key', 300, fn () =>
            Setting::get('stripe_key') ?: (string) config('services.stripe.key')
        );
    }

    private function stripeWebhookSecret(): string
    {
        return Cache::remember('stripe_webhook_secret', 300, fn () =>
            Setting::get('stripe_webhook_secret') ?: (string) config('services.stripe.webhook_secret')
        );
    }

    public function create(array $payload): array
    {
        $amount = max(0, (int) ($payload['amount'] ?? 0));
        $currency = strtolower((string) ($payload['currency'] ?? 'usd'));
        $email = trim((string) ($payload['email'] ?? ''));
        $secret = $this->stripeSecret();
        $publishableKey = $this->stripeKey();

        if ($amount <= 0) {
            throw new RuntimeException('Stripe payment intent requires a positive amount.');
        }

        if (! $secret) {
            return [
                'intent_id' => 'pi_placeholder_' . Str::lower(Str::random(14)),
                'client_secret' => 'pi_placeholder_secret_' . Str::lower(Str::random(24)),
                'amount' => $amount,
                'currency' => strtoupper($currency),
                'status' => 'requires_payment_method',
                'mode' => 'placeholder',
                'gateway' => 'stripe',
                'publishable_key' => $publishableKey,
            ];
        }

        $response = Http::withBasicAuth($secret, '')
            ->asForm()
            ->post('https://api.stripe.com/v1/payment_intents', array_filter([
                'amount' => $amount,
                'currency' => $currency,
                'receipt_email' => $email ?: null,
                'automatic_payment_methods[enabled]' => 'true',
                'metadata[source]' => 'petposture-checkout',
                'metadata[email]' => $email ?: null,
            ], static fn ($value) => $value !== null && $value !== ''));

        if (! $response->successful()) {
            throw new RuntimeException(
                $response->json('error.message')
                    ?? 'Stripe payment intent creation failed.'
            );
        }

        return [
            'intent_id' => (string) $response->json('id'),
            'client_secret' => (string) $response->json('client_secret'),
            'amount' => (int) $response->json('amount'),
            'currency' => strtoupper((string) $response->json('currency')),
            'status' => (string) $response->json('status'),
            'mode' => 'configured',
            'gateway' => 'stripe',
            'publishable_key' => $publishableKey,
        ];
    }

    /**
     * Fetches the Radar fraud outcome for a Stripe charge (risk_level/risk_score are
     * populated by Stripe Radar automatically on every charge, free on any Stripe account).
     */
    private function fetchChargeOutcome(string $chargeId): ?array
    {
        $secret = $this->stripeSecret();

        if (! $secret) {
            return null;
        }

        $response = Http::withBasicAuth($secret, '')
            ->get("https://api.stripe.com/v1/charges/{$chargeId}");

        if (! $response->successful()) {
            return null;
        }

        return $response->json('outcome');
    }

    public function prepareRetryIntent(Order $order): array
    {
        $amount = $this->resolveOrderAmount($order);

        if ($amount <= 0) {
            throw new RuntimeException('Order total must be positive to retry payment.');
        }

        $intent = $this->create([
            'payment_method' => 'card',
            'amount' => $amount,
            'currency' => strtolower((string) ($order->currency_code ?: 'usd')),
            'email' => (string) ($order->customer_reference ?? ''),
        ]);

        $meta = (array) ($order->meta ?? []);
        $meta['payment_intent_id'] = $intent['intent_id'];
        $meta['payment_client_secret'] = $intent['client_secret'];
        $meta['payment_intent_status'] = $intent['status'];
        $meta['payment_status'] = 'pending';
        $meta['payment_provider_mode'] = $intent['mode'];

        $order->update([
            'meta' => $meta,
        ]);

        $this->orderEventService->record(
            $order,
            'payment.retry_prepared',
            'Payment retry prepared',
            'A new payment attempt was prepared for this order.'
        );

        return $intent;
    }

    public function handleWebhook(string $payload, ?string $signature = null): array
    {
        $secret = $this->stripeWebhookSecret();

        if ($secret !== '') {
            $this->assertValidSignature($payload, $signature, $secret);
        }

        /** @var array<string,mixed> $event */
        $event = json_decode($payload, true, 512, JSON_THROW_ON_ERROR);
        $type = (string) ($event['type'] ?? '');
        $eventId = (string) ($event['id'] ?? '');
        $object = (array) (($event['data']['object'] ?? []) ?: []);
        $intentId = (string) ($object['id'] ?? '');

        if ($eventId === '') {
            throw new RuntimeException('Stripe webhook payload is missing event ID.');
        }

        if ($intentId === '') {
            throw new RuntimeException('Stripe webhook payload is missing payment intent ID.');
        }

        $order = Order::query()->where('meta->payment_intent_id', $intentId)->first();
        $eventRecord = $this->captureWebhookEvent($eventId, $type, $intentId, $order?->id, $event);

        if (! $eventRecord['created']) {
            return [
                'processed' => false,
                'reason' => 'duplicate_event',
                'event_type' => $type,
                'event_id' => $eventId,
                'payment_intent_id' => $intentId,
                'order_reference' => $order?->reference,
            ];
        }

        if (! $order) {
            $eventRecord['model']->update([
                'status' => 'orphaned',
                'processed_at' => now(),
            ]);

            return [
                'processed' => false,
                'reason' => 'order_not_found',
                'event_type' => $type,
                'event_id' => $eventId,
                'payment_intent_id' => $intentId,
            ];
        }

        $paymentStatus = match ($type) {
            'payment_intent.succeeded' => 'paid',
            'payment_intent.payment_failed' => 'failed',
            'payment_intent.canceled' => 'cancelled',
            default => 'pending',
        };

        $paymentData = [
            'payment_status' => $paymentStatus,
            'payment_intent_status' => (string) ($object['status'] ?? ''),
            'event_type' => $type,
            'event_id' => $eventId,
        ];

        if ($type === 'payment_intent.succeeded') {
            $chargeId = (string) ($object['latest_charge'] ?? '');
            $outcome = $chargeId !== '' ? $this->fetchChargeOutcome($chargeId) : null;

            if ($outcome) {
                $paymentData['fraud_risk_level'] = $outcome['risk_level'] ?? null;
                $paymentData['fraud_risk_score'] = $outcome['risk_score'] ?? null;
                $paymentData['fraud_seller_message'] = $outcome['seller_message'] ?? null;
            }
        }

        $updatedOrder = $this->orderOperationsService->syncStripePayment($order, $paymentData);

        $alertService = app(PaymentFailureAlertService::class);
        if ($paymentStatus === 'failed') {
            $alertService->record($updatedOrder);
        } elseif ($paymentStatus === 'paid') {
            $alertService->reset($updatedOrder);
        }

        $eventRecord['model']->update([
            'order_id' => $updatedOrder->id,
            'status' => 'processed',
            'processed_at' => now(),
        ]);

        return [
            'processed' => true,
            'event_type' => $type,
            'event_id' => $eventId,
            'payment_intent_id' => $intentId,
            'order_reference' => $updatedOrder->reference,
            'payment_status' => $paymentStatus,
        ];
    }

    /**
     * @return array{created: bool, model: StripeWebhookEvent}
     */
    private function captureWebhookEvent(string $eventId, string $type, string $intentId, ?int $orderId, array $event): array
    {
        $existing = StripeWebhookEvent::query()->where('event_id', $eventId)->first();

        if ($existing) {
            return [
                'created' => false,
                'model' => $existing,
            ];
        }

        try {
            $created = StripeWebhookEvent::query()->create([
                'event_id' => $eventId,
                'event_type' => $type,
                'payment_intent_id' => $intentId,
                'order_id' => $orderId,
                'status' => 'received',
                'payload' => $event,
            ]);
        } catch (\Illuminate\Database\QueryException $exception) {
            if ((string) $exception->getCode() !== '23000') {
                throw $exception;
            }

            return [
                'created' => false,
                'model' => StripeWebhookEvent::query()->where('event_id', $eventId)->firstOrFail(),
            ];
        }

        return [
            'created' => true,
            'model' => $created,
        ];
    }

    public function refund(string $paymentIntentId, ?int $amountMinor = null): array
    {
        $secret = $this->stripeSecret();

        if (! $secret) {
            return [
                'refund_id' => 're_placeholder_' . Str::lower(Str::random(14)),
                'status' => 'succeeded',
                'amount' => $amountMinor,
                'mode' => 'placeholder',
            ];
        }

        $params = ['payment_intent' => $paymentIntentId];

        if ($amountMinor !== null) {
            $params['amount'] = $amountMinor;
        }

        $response = Http::withBasicAuth($secret, '')
            ->asForm()
            ->post('https://api.stripe.com/v1/refunds', $params);

        if (! $response->successful()) {
            throw new RuntimeException(
                $response->json('error.message') ?? 'Stripe refund failed.'
            );
        }

        return [
            'refund_id' => (string) $response->json('id'),
            'status' => (string) $response->json('status'),
            'amount' => (int) $response->json('amount'),
            'mode' => 'configured',
        ];
    }

    private function assertValidSignature(string $payload, ?string $signature, string $secret): void
    {
        if (! $signature) {
            throw new RuntimeException('Missing Stripe signature header.');
        }

        $parts = [];

        foreach (explode(',', $signature) as $part) {
            [$key, $value] = array_pad(explode('=', $part, 2), 2, null);

            if ($key && $value) {
                $parts[trim($key)] = trim($value);
            }
        }

        $timestamp = $parts['t'] ?? null;
        $hash = $parts['v1'] ?? null;

        if (! $timestamp || ! $hash) {
            throw new RuntimeException('Invalid Stripe signature header.');
        }

        $expected = hash_hmac('sha256', $timestamp . '.' . $payload, $secret);

        if (! hash_equals($expected, $hash)) {
            throw new RuntimeException('Invalid Stripe webhook signature.');
        }
    }

    private function resolveOrderAmount(Order $order): int
    {
        $amount = $order->total;

        if (is_object($amount) && property_exists($amount, 'value')) {
            return (int) $amount->value;
        }

        if (is_object($amount) && method_exists($amount, 'value')) {
            return (int) $amount->value;
        }

        if (is_numeric($amount)) {
            return (int) $amount;
        }

        return 0;
    }
}
