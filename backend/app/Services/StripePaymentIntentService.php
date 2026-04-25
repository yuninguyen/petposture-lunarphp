<?php

namespace App\Services;

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

    public function create(array $payload): array
    {
        $amount = max(0, (int) ($payload['amount'] ?? 0));
        $currency = strtolower((string) ($payload['currency'] ?? 'usd'));
        $email = trim((string) ($payload['email'] ?? ''));
        $secret = (string) config('services.stripe.secret');
        $publishableKey = config('services.stripe.key');

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
        $secret = (string) config('services.stripe.webhook_secret');

        if ($secret !== '') {
            $this->assertValidSignature($payload, $signature, $secret);
        }

        /** @var array<string,mixed> $event */
        $event = json_decode($payload, true, 512, JSON_THROW_ON_ERROR);
        $type = (string) ($event['type'] ?? '');
        $eventId = (string) ($event['id'] ?? '');
        $object = (array) (($event['data']['object'] ?? []) ?: []);
        $intentId = (string) ($object['id'] ?? '');

        if ($intentId === '') {
            throw new RuntimeException('Stripe webhook payload is missing payment intent ID.');
        }

        $order = Order::query()->where('meta->payment_intent_id', $intentId)->first();

        if (! $order) {
            return [
                'processed' => false,
                'reason' => 'order_not_found',
                'event_type' => $type,
                'event_id' => $eventId,
                'payment_intent_id' => $intentId,
            ];
        }

        $lastEventId = (string) (($order->meta['payment_last_event_id'] ?? '') ?: '');

        if ($eventId !== '' && $lastEventId === $eventId) {
            return [
                'processed' => false,
                'reason' => 'duplicate_event',
                'event_type' => $type,
                'event_id' => $eventId,
                'payment_intent_id' => $intentId,
                'order_reference' => $order->reference,
            ];
        }

        $paymentStatus = match ($type) {
            'payment_intent.succeeded' => 'paid',
            'payment_intent.payment_failed' => 'failed',
            'payment_intent.canceled' => 'cancelled',
            default => 'pending',
        };

        $updatedOrder = $this->orderOperationsService->syncStripePayment($order, [
            'payment_status' => $paymentStatus,
            'payment_intent_status' => (string) ($object['status'] ?? ''),
            'event_type' => $type,
            'event_id' => $eventId,
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
