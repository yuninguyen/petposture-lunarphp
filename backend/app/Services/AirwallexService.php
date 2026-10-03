<?php

namespace App\Services;

use App\Models\PaymentWebhookEvent;
use App\Models\Setting;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Lunar\Models\Order;
use RuntimeException;
use Throwable;

/**
 * Airwallex PaymentIntent + Hosted Payment Page integration. The server creates the intent
 * (with return_url, our session token in metadata and the shipping address); the browser
 * redirects to Airwallex's page with Airwallex.js; payment_intent.* webhooks mark the order.
 * Payment Links were tried first but gave no way back to the site and no usable webhook link
 * to the order. Field names were checked against the sandbox; re-check before AIRWALLEX_MODE=live.
 */
class AirwallexService
{
    public function __construct(
        private readonly OrderOperationsService $orderOperationsService,
    ) {}

    private function clientId(): string
    {
        return Cache::remember('airwallex_client_id', 300, fn () => Setting::get('airwallex_client_id') ?: (string) config('services.airwallex.client_id')
        );
    }

    private function apiKey(): string
    {
        return Cache::remember('airwallex_api_key', 300, fn () => Setting::get('airwallex_api_key') ?: (string) config('services.airwallex.api_key')
        );
    }

    private function webhookSecret(): string
    {
        return Cache::remember('airwallex_webhook_secret', 300, fn () => Setting::get('airwallex_webhook_secret') ?: (string) config('services.airwallex.webhook_secret')
        );
    }

    private function mode(): string
    {
        return Cache::remember('airwallex_mode', 300, fn () => Setting::get('airwallex_mode') ?: (string) config('services.airwallex.mode', 'sandbox')
        );
    }

    public function isConfigured(): bool
    {
        return filled($this->clientId()) && filled($this->apiKey());
    }

    private function baseUrl(): string
    {
        return $this->mode() === 'live'
            ? 'https://api.airwallex.com'
            : 'https://api-demo.airwallex.com';
    }

    private function accessToken(): string
    {
        return Cache::remember('airwallex_access_token_'.$this->mode(), 1500, function () {
            $response = Http::withHeaders([
                'x-client-id' => $this->clientId(),
                'x-api-key' => $this->apiKey(),
            ])->post($this->baseUrl().'/api/v1/authentication/login');

            if (! $response->successful()) {
                throw new RuntimeException(
                    $response->json('message') ?? 'Airwallex authentication failed.'
                );
            }

            return (string) $response->json('token');
        });
    }

    /**
     * The payment method types this Airwallex account can offer for USD / US (read-only).
     *
     * @return array<int, array<string, mixed>>|null null when they could not be read
     */
    public function paymentMethodTypes(): ?array
    {
        if (! $this->isConfigured()) {
            return null;
        }

        try {
            $token = $this->accessToken();
            $items = [];

            for ($page = 0; $page < 10; $page++) {
                $response = Http::withToken($token)->timeout(5)->get($this->baseUrl().'/api/v1/pa/config/payment_method_types', [
                    'transaction_currency' => 'USD',
                    'country_code' => 'US',
                    'page_num' => $page,
                    'page_size' => 100,
                ]);

                if (! $response->successful()) {
                    return null;
                }

                array_push($items, ...($response->json('items') ?? []));

                if (! $response->json('has_more')) {
                    break;
                }
            }

            return $items;
        } catch (Throwable) {
            return null;
        }
    }

    private function minorToDecimal(int $amountMinor): string
    {
        return number_format($amountMinor / 100, 2, '.', '');
    }

    /** Airwallex.js environment name for the configured mode ('demo' for sandbox, 'prod' for live). */
    public function sdkEnvironment(): string
    {
        return $this->mode() === 'live' ? 'prod' : 'demo';
    }

    /**
     * Creates the PaymentIntent the Airwallex Hosted Payment Page pays: the browser redirects
     * there with Airwallex.js (intent_id + client_secret) and comes back to $returnUrl.
     * $sessionToken is our own id for this attempt; it is stored on the intent (metadata and
     * merchant_order_id) and later on the order, so webhooks and the success page can find it.
     *
     * @param  array{email?: string, first_name?: string, last_name?: string}  $customer
     * @param  array{first_name?: string, last_name?: string, address?: array<string, mixed>}  $shipping
     * @return array{intent_id: string, client_secret: string, currency: string, env: string, mode: string}
     */
    public function createPaymentIntent(int $amountMinor, string $currency, string $sessionToken, string $returnUrl, array $customer = [], array $shipping = []): array
    {
        $currency = strtoupper($currency);

        if (! $this->isConfigured()) {
            return [
                'intent_id' => 'int_placeholder_'.Str::lower(Str::random(14)),
                'client_secret' => 'placeholder_secret_'.Str::lower(Str::random(24)),
                'currency' => $currency,
                'env' => $this->sdkEnvironment(),
                'mode' => 'placeholder',
            ];
        }

        $payload = [
            'request_id' => $sessionToken,
            'amount' => (float) $this->minorToDecimal($amountMinor),
            'currency' => $currency,
            'merchant_order_id' => $sessionToken,
            'return_url' => $returnUrl,
            'metadata' => ['session_id' => $sessionToken],
            'customer' => array_filter($customer, static fn ($value) => filled($value)),
            'order' => ['shipping' => $shipping],
        ];

        $response = Http::withToken($this->accessToken())
            ->post($this->baseUrl().'/api/v1/pa/payment_intents/create', $payload);

        if (! $response->successful()) {
            throw new RuntimeException(
                $response->json('message') ?? 'Airwallex payment intent creation failed.'
            );
        }

        return [
            'intent_id' => (string) $response->json('id'),
            'client_secret' => (string) $response->json('client_secret'),
            'currency' => $currency,
            'env' => $this->sdkEnvironment(),
            'mode' => 'configured',
        ];
    }

    /**
     * @return array{refund_id: string, status: string, amount: int}
     */
    public function refund(string $intentId, int $amountMinor, string $currency): array
    {
        if (! $this->isConfigured()) {
            return [
                'refund_id' => 'rfd_placeholder_'.Str::lower(Str::random(14)),
                'status' => 'SUCCEEDED',
                'amount' => $amountMinor,
            ];
        }

        $response = Http::withToken($this->accessToken())
            ->post($this->baseUrl().'/api/v1/pa/refunds/create', [
                'request_id' => 'refund-'.$intentId.'-'.$amountMinor.'-'.Str::lower(Str::random(8)),
                'payment_intent_id' => $intentId,
                'amount' => (float) $this->minorToDecimal($amountMinor),
                'currency' => strtoupper($currency),
            ]);

        if (! $response->successful()) {
            throw new RuntimeException(
                $response->json('message') ?? 'Airwallex refund failed.'
            );
        }

        return [
            'refund_id' => (string) $response->json('id'),
            'status' => (string) $response->json('status'),
            'amount' => (int) round(((float) ($response->json('amount') ?? $this->minorToDecimal($amountMinor))) * 100),
        ];
    }

    private function verifyWebhookSignature(?string $signature, ?string $timestamp, string $rawBody): bool
    {
        $secret = $this->webhookSecret();

        if ($secret === '') {
            return true;
        }

        if (! $signature || ! $timestamp) {
            return false;
        }

        $expected = hash_hmac('sha256', $timestamp.$rawBody, $secret);

        return hash_equals($expected, $signature);
    }

    public function handleWebhook(string $payload, ?string $signature, ?string $timestamp): array
    {
        if (! $this->verifyWebhookSignature($signature, $timestamp, $payload)) {
            throw new RuntimeException('Invalid Airwallex webhook signature.');
        }

        $event = json_decode($payload, true, 512, JSON_THROW_ON_ERROR);
        $type = (string) ($event['name'] ?? $event['type'] ?? '');
        $eventId = (string) ($event['id'] ?? '');
        $object = (array) ($event['data']['object'] ?? []);

        if ($eventId === '') {
            throw new RuntimeException('Airwallex webhook payload is missing event ID.');
        }

        // payment_intent.* events carry the intent itself; payment_attempt.* events point at it.
        $intentId = (string) ($object['payment_intent_id'] ?? $object['id'] ?? '');
        $sessionToken = (string) ($object['metadata']['session_id'] ?? '');

        $order = $intentId !== ''
            ? Order::query()->where('meta->airwallex_intent_id', $intentId)->first()
            : null;

        if (! $order && $sessionToken !== '') {
            $order = Order::query()->where('meta->airwallex_session_id', $sessionToken)->first();
        }

        $eventRecord = $this->captureWebhookEvent($eventId, $type, $intentId, $order?->id, $event);

        if (! $eventRecord['created']) {
            return ['processed' => false, 'reason' => 'duplicate_event', 'event_type' => $type, 'event_id' => $eventId];
        }

        if (! $order) {
            $eventRecord['model']->update(['status' => 'orphaned', 'processed_at' => now()]);

            return ['processed' => false, 'reason' => 'order_not_found', 'event_type' => $type, 'event_id' => $eventId];
        }

        $paymentStatus = match ($type) {
            'payment_intent.succeeded' => 'paid',
            'payment_attempt.failed_to_process', 'payment_attempt.authorization_failed', 'payment_attempt.authentication_failed', 'payment_intent.payment_failed' => 'failed',
            'payment_intent.cancelled' => 'cancelled',
            default => null,
        };

        if ($paymentStatus !== null) {
            $this->orderOperationsService->syncRedirectGatewayPayment($order, 'Airwallex', [
                'payment_status' => $paymentStatus,
                'event_type' => $type,
                'event_id' => $eventId,
            ] + $this->cardDetails($object));
        }

        $eventRecord['model']->update([
            'order_id' => $order->id,
            'status' => 'processed',
            'processed_at' => now(),
        ]);

        return [
            'processed' => true,
            'event_type' => $type,
            'event_id' => $eventId,
            'order_reference' => $order->reference,
            'payment_status' => $paymentStatus,
        ];
    }

    /**
     * The card brand / last 4 / funding the shopper paid with, when the event carries them: a
     * payment_attempt.* event holds it as payment_method.card, a payment_intent.* event under
     * latest_payment_attempt. Empty when absent so an event without a card never wipes what is stored.
     *
     * @param  array<string, mixed>  $object
     * @return array<string, string|null>
     */
    private function cardDetails(array $object): array
    {
        $card = $object['payment_method']['card'] ?? $object['latest_payment_attempt']['payment_method']['card'] ?? null;

        if (! is_array($card) || empty($card['brand'])) {
            return [];
        }

        $funding = strtolower((string) ($card['card_type'] ?? ''));

        return [
            'card_brand' => strtolower((string) $card['brand']),
            'card_last4' => isset($card['last4']) ? (string) $card['last4'] : null,
            'card_funding' => in_array($funding, ['credit', 'debit', 'prepaid'], true) ? $funding : null,
        ];
    }

    /**
     * @return array{created: bool, model: PaymentWebhookEvent}
     */
    private function captureWebhookEvent(string $eventId, string $type, string $externalReference, ?int $orderId, array $event): array
    {
        $existing = PaymentWebhookEvent::query()->where('gateway', 'airwallex')->where('event_id', $eventId)->first();

        if ($existing) {
            return ['created' => false, 'model' => $existing];
        }

        try {
            $created = PaymentWebhookEvent::query()->create([
                'gateway' => 'airwallex',
                'event_id' => $eventId,
                'event_type' => $type,
                'external_reference' => $externalReference,
                'order_id' => $orderId,
                'status' => 'received',
                'payload' => $event,
            ]);
        } catch (QueryException $exception) {
            if ((string) $exception->getCode() !== '23000') {
                throw $exception;
            }

            return [
                'created' => false,
                'model' => PaymentWebhookEvent::query()->where('gateway', 'airwallex')->where('event_id', $eventId)->firstOrFail(),
            ];
        }

        return ['created' => true, 'model' => $created];
    }
}
