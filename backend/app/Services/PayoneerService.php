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
 * Payoneer Checkout integration. Payoneer's public documentation site did not
 * yield a scrapeable API reference at plan time, so the request/response shape
 * in createCheckoutSession() is a best-effort reconstruction (Payoneer Checkout
 * is built on the former "optile" payment network hub) — treat as UNVERIFIED
 * and confirm against Payoneer's real API reference or a sandbox account before
 * setting PAYONEER_MODE=live. Isolated to this one method by design so fixing
 * it later is a single, contained edit.
 */
class PayoneerService
{
    public function __construct(
        private readonly OrderOperationsService $orderOperationsService,
    ) {}

    private function merchantCode(): string
    {
        return Cache::remember('payoneer_merchant_code', 300, fn () => Setting::get('payoneer_merchant_code') ?: (string) config('services.payoneer.merchant_code')
        );
    }

    private function apiKey(): string
    {
        return Cache::remember('payoneer_api_key', 300, fn () => Setting::get('payoneer_api_key') ?: (string) config('services.payoneer.api_key')
        );
    }

    private function apiSecret(): string
    {
        return Cache::remember('payoneer_api_secret', 300, fn () => Setting::get('payoneer_api_secret') ?: (string) config('services.payoneer.api_secret')
        );
    }

    private function webhookSecret(): string
    {
        return Cache::remember('payoneer_webhook_secret', 300, fn () => Setting::get('payoneer_webhook_secret') ?: (string) config('services.payoneer.webhook_secret')
        );
    }

    private function mode(): string
    {
        return Cache::remember('payoneer_mode', 300, fn () => Setting::get('payoneer_mode') ?: (string) config('services.payoneer.mode', 'sandbox')
        );
    }

    public function isConfigured(): bool
    {
        return filled($this->merchantCode()) && filled($this->apiKey()) && filled($this->apiSecret());
    }

    private function baseUrl(): string
    {
        return $this->mode() === 'live'
            ? 'https://checkout-api.payoneer.com'
            : 'https://checkout-api.sandbox.payoneer.com';
    }

    private function minorToDecimal(int $amountMinor): string
    {
        return number_format($amountMinor / 100, 2, '.', '');
    }

    public function createCheckoutSession(int $amountMinor, string $currency, string $orderReference, string $returnUrl): array
    {
        if (! $this->isConfigured()) {
            return [
                'session_id' => 'PAYONEER-PLACEHOLDER-'.Str::upper(Str::random(14)),
                'checkout_url' => $returnUrl,
                'mode' => 'placeholder',
            ];
        }

        $response = Http::withBasicAuth($this->apiKey(), $this->apiSecret())
            ->post($this->baseUrl().'/checkout/api/lists', [
                'merchantCode' => $this->merchantCode(),
                'transactionId' => $orderReference,
                'integration' => 'HOSTED',
                'amount' => $this->minorToDecimal($amountMinor),
                'currency' => strtoupper($currency),
                'style' => [
                    'redirectUrl' => $returnUrl,
                ],
            ]);

        if (! $response->successful()) {
            throw new RuntimeException(
                $response->json('resultInfo') ?? 'Payoneer checkout session creation failed.'
            );
        }

        $sessionId = (string) ($response->json('listUid') ?? $response->json('id') ?? '');
        $checkoutUrl = (string) (
            $response->json('links.self.href')
            ?? $response->json('_links.self.href')
            ?? ''
        );

        if ($sessionId === '' || $checkoutUrl === '') {
            throw new RuntimeException('Payoneer checkout session response did not include a redirect URL — API contract needs re-verification.');
        }

        return [
            'session_id' => $sessionId,
            'checkout_url' => $checkoutUrl,
            'mode' => 'configured',
        ];
    }

    private function verifyWebhookSignature(?string $signature, string $rawBody): bool
    {
        $secret = $this->webhookSecret();

        if ($secret === '') {
            return true;
        }

        if (! $signature) {
            return false;
        }

        $expected = hash_hmac('sha256', $rawBody, $secret);

        return hash_equals($expected, $signature);
    }

    public function handleWebhook(string $payload, ?string $signature): array
    {
        if (! $this->verifyWebhookSignature($signature, $payload)) {
            throw new RuntimeException('Invalid Payoneer webhook signature.');
        }

        $event = json_decode($payload, true, 512, JSON_THROW_ON_ERROR);
        $type = (string) ($event['transaction']['type'] ?? $event['type'] ?? '');
        $eventId = (string) ($event['transaction']['transactionId'] ?? $event['id'] ?? '');
        $orderReference = (string) ($event['transaction']['refId'] ?? $event['merchantTransactionId'] ?? '');
        $sessionId = (string) ($event['listUid'] ?? '');

        if ($eventId === '') {
            throw new RuntimeException('Payoneer webhook payload is missing a transaction/event ID.');
        }

        $order = $orderReference !== ''
            ? Order::query()->where('reference', $orderReference)->first()
            : null;

        if (! $order && $sessionId !== '') {
            $order = Order::query()->where('meta->payoneer_session_id', $sessionId)->first();
        }

        $eventRecord = $this->captureWebhookEvent($eventId, $type, $sessionId, $order?->id, $event);

        if (! $eventRecord['created']) {
            return ['processed' => false, 'reason' => 'duplicate_event', 'event_type' => $type, 'event_id' => $eventId];
        }

        if (! $order) {
            $eventRecord['model']->update(['status' => 'orphaned', 'processed_at' => now()]);

            return ['processed' => false, 'reason' => 'order_not_found', 'event_type' => $type, 'event_id' => $eventId];
        }

        $paymentStatus = match (strtoupper($type)) {
            'CHARGE', 'CAPTURE' => 'paid',
            'ABORT', 'DENY' => 'failed',
            default => null,
        };

        if ($paymentStatus !== null) {
            $this->orderOperationsService->syncRedirectGatewayPayment($order, 'Payoneer', [
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
        $existing = PaymentWebhookEvent::query()->where('gateway', 'payoneer')->where('event_id', $eventId)->first();

        if ($existing) {
            return ['created' => false, 'model' => $existing];
        }

        try {
            $created = PaymentWebhookEvent::query()->create([
                'gateway' => 'payoneer',
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
                'model' => PaymentWebhookEvent::query()->where('gateway', 'payoneer')->where('event_id', $eventId)->firstOrFail(),
            ];
        }

        return ['created' => true, 'model' => $created];
    }
}
