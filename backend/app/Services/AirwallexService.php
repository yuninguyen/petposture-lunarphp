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

/**
 * Airwallex "Payment Links" integration — chosen over the PaymentIntent + Hosted
 * Payment Page flow because Payment Links return a plain redirect URL from the
 * server, matching this codebase's redirect-checkout contract without needing
 * Airwallex.js client-side. Endpoint/field names here should be re-verified
 * against Airwallex's live API reference before enabling AIRWALLEX_MODE=live —
 * see the payment-gateways plan note on Airwallex confidence.
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

    private function minorToDecimal(int $amountMinor): string
    {
        return number_format($amountMinor / 100, 2, '.', '');
    }

    public function createCheckoutSession(int $amountMinor, string $currency, string $orderReference, string $returnUrl): array
    {
        if (! $this->isConfigured()) {
            return [
                'session_id' => 'AIRWALLEX-PLACEHOLDER-'.Str::upper(Str::random(14)),
                'checkout_url' => $returnUrl,
                'mode' => 'placeholder',
            ];
        }

        $response = Http::withToken($this->accessToken())
            ->post($this->baseUrl().'/api/v1/pa/payment_links/create', [
                'amount' => $this->minorToDecimal($amountMinor),
                'currency' => strtoupper($currency),
                'title' => "Order {$orderReference}",
                'reusable' => false,
                'metadata' => [
                    'order_reference' => $orderReference,
                ],
            ]);

        if (! $response->successful()) {
            throw new RuntimeException(
                $response->json('message') ?? 'Airwallex payment link creation failed.'
            );
        }

        return [
            'session_id' => (string) $response->json('id'),
            'checkout_url' => (string) $response->json('url'),
            'mode' => 'configured',
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

        $sessionId = (string) ($object['id'] ?? '');
        $orderReference = (string) ($object['metadata']['order_reference'] ?? '');

        $order = $orderReference !== ''
            ? Order::query()->where('reference', $orderReference)->first()
            : null;

        if (! $order && $sessionId !== '') {
            $order = Order::query()->where('meta->airwallex_session_id', $sessionId)->first();
        }

        $eventRecord = $this->captureWebhookEvent($eventId, $type, $sessionId, $order?->id, $event);

        if (! $eventRecord['created']) {
            return ['processed' => false, 'reason' => 'duplicate_event', 'event_type' => $type, 'event_id' => $eventId];
        }

        if (! $order) {
            $eventRecord['model']->update(['status' => 'orphaned', 'processed_at' => now()]);

            return ['processed' => false, 'reason' => 'order_not_found', 'event_type' => $type, 'event_id' => $eventId];
        }

        $paymentStatus = match ($type) {
            'payment_link.paid', 'payment_intent.succeeded' => 'paid',
            'payment_attempt.failed_to_process', 'payment_intent.payment_failed' => 'failed',
            'payment_link.expired', 'payment_intent.cancelled' => 'cancelled',
            default => null,
        };

        if ($paymentStatus !== null) {
            $this->orderOperationsService->syncRedirectGatewayPayment($order, 'Airwallex', [
                'payment_status' => $paymentStatus,
                'event_type' => $type,
                'event_id' => $eventId,
            ]);
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
