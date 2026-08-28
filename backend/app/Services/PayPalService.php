<?php

namespace App\Services;

use App\Models\PayPalWebhookEvent;
use App\Models\Setting;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Lunar\Models\Order;
use RuntimeException;

class PayPalService
{
    public function __construct(
        private readonly OrderOperationsService $orderOperationsService,
    ) {}

    public function clientId(): string
    {
        return Cache::remember('paypal_client_id', 300, fn () => Setting::get('paypal_client_id') ?: (string) config('services.paypal.client_id')
        );
    }

    private function clientSecret(): string
    {
        return Cache::remember('paypal_client_secret', 300, fn () => Setting::get('paypal_client_secret') ?: (string) config('services.paypal.client_secret')
        );
    }

    private function mode(): string
    {
        return Cache::remember('paypal_mode', 300, fn () => Setting::get('paypal_mode') ?: (string) config('services.paypal.mode', 'sandbox')
        );
    }

    private function webhookId(): string
    {
        return Cache::remember('paypal_webhook_id', 300, fn () => Setting::get('paypal_webhook_id') ?: (string) config('services.paypal.webhook_id')
        );
    }

    public function isConfigured(): bool
    {
        return filled($this->clientId()) && filled($this->clientSecret());
    }

    private function baseUrl(): string
    {
        return $this->mode() === 'live'
            ? 'https://api-m.paypal.com'
            : 'https://api-m.sandbox.paypal.com';
    }

    private function accessToken(): string
    {
        return Cache::remember('paypal_access_token_'.$this->mode(), 28800, function () {
            $response = Http::asForm()
                ->withBasicAuth($this->clientId(), $this->clientSecret())
                ->post($this->baseUrl().'/v1/oauth2/token', [
                    'grant_type' => 'client_credentials',
                ]);

            if (! $response->successful()) {
                throw new RuntimeException(
                    $response->json('error_description') ?? 'PayPal authentication failed.'
                );
            }

            return (string) $response->json('access_token');
        });
    }

    private function minorToDecimal(int $amountMinor): string
    {
        return number_format($amountMinor / 100, 2, '.', '');
    }

    public function createOrder(int $amountMinor, string $currency): array
    {
        if ($amountMinor <= 0) {
            throw new RuntimeException('PayPal order requires a positive amount.');
        }

        $currency = strtoupper($currency);

        if (! $this->isConfigured()) {
            return [
                'paypal_order_id' => 'PAYPAL-PLACEHOLDER-'.Str::upper(Str::random(14)),
                'status' => 'CREATED',
                'amount' => $amountMinor,
                'currency' => $currency,
                'mode' => 'placeholder',
                'client_id' => $this->clientId(),
            ];
        }

        $response = Http::withToken($this->accessToken())
            ->post($this->baseUrl().'/v2/checkout/orders', [
                'intent' => 'CAPTURE',
                'purchase_units' => [[
                    'amount' => [
                        'currency_code' => $currency,
                        'value' => $this->minorToDecimal($amountMinor),
                    ],
                ]],
            ]);

        if (! $response->successful()) {
            throw new RuntimeException(
                $response->json('message') ?? 'PayPal order creation failed.'
            );
        }

        return [
            'paypal_order_id' => (string) $response->json('id'),
            'status' => (string) $response->json('status'),
            'amount' => $amountMinor,
            'currency' => $currency,
            'mode' => 'configured',
            'client_id' => $this->clientId(),
        ];
    }

    public function captureOrder(string $paypalOrderId): array
    {
        if (! $this->isConfigured() || str_starts_with($paypalOrderId, 'PAYPAL-PLACEHOLDER-')) {
            return [
                'capture_id' => 'CAPTURE-PLACEHOLDER-'.Str::upper(Str::random(14)),
                'status' => 'COMPLETED',
                'payer_email' => null,
                'amount' => null,
                'currency' => null,
                'mode' => 'placeholder',
            ];
        }

        $response = Http::withToken($this->accessToken())
            ->post($this->baseUrl()."/v2/checkout/orders/{$paypalOrderId}/capture", []);

        if (! $response->successful()) {
            throw new RuntimeException(
                $response->json('message') ?? 'PayPal capture failed.'
            );
        }

        $capture = $response->json('purchase_units.0.payments.captures.0');

        return [
            'capture_id' => (string) ($capture['id'] ?? ''),
            'status' => (string) ($capture['status'] ?? $response->json('status')),
            'payer_email' => $response->json('payer.email_address'),
            'amount' => isset($capture['amount']['value']) ? (int) round(((float) $capture['amount']['value']) * 100) : null,
            'currency' => $capture['amount']['currency_code'] ?? null,
            'mode' => 'configured',
        ];
    }

    public function refund(string $captureId, ?int $amountMinor, string $currency): array
    {
        if (! $this->isConfigured() || str_starts_with($captureId, 'CAPTURE-PLACEHOLDER-')) {
            return [
                'refund_id' => 'REFUND-PLACEHOLDER-'.Str::upper(Str::random(14)),
                'status' => 'COMPLETED',
                'amount' => $amountMinor,
                'mode' => 'placeholder',
            ];
        }

        $body = [];

        if ($amountMinor !== null) {
            $body['amount'] = [
                'value' => $this->minorToDecimal($amountMinor),
                'currency_code' => strtoupper($currency),
            ];
        }

        $response = Http::withToken($this->accessToken())
            ->post($this->baseUrl()."/v2/payments/captures/{$captureId}/refund", $body);

        if (! $response->successful()) {
            throw new RuntimeException(
                $response->json('message') ?? 'PayPal refund failed.'
            );
        }

        $refundedValue = $response->json('amount.value');

        return [
            'refund_id' => (string) $response->json('id'),
            'status' => (string) $response->json('status'),
            'amount' => $refundedValue !== null ? (int) round(((float) $refundedValue) * 100) : $amountMinor,
            'mode' => 'configured',
        ];
    }

    private function verifyWebhookSignature(array $headers, string $rawBody): bool
    {
        $webhookId = $this->webhookId();

        if ($webhookId === '') {
            return true;
        }

        $response = Http::withToken($this->accessToken())
            ->post($this->baseUrl().'/v1/notifications/verify-webhook-signature', [
                'auth_algo' => $headers['auth_algo'] ?? '',
                'cert_url' => $headers['cert_url'] ?? '',
                'transmission_id' => $headers['transmission_id'] ?? '',
                'transmission_sig' => $headers['transmission_sig'] ?? '',
                'transmission_time' => $headers['transmission_time'] ?? '',
                'webhook_id' => $webhookId,
                'webhook_event' => json_decode($rawBody, true),
            ]);

        return $response->successful() && $response->json('verification_status') === 'SUCCESS';
    }

    public function handleWebhook(string $payload, array $headers): array
    {
        if (! $this->verifyWebhookSignature($headers, $payload)) {
            throw new RuntimeException('Invalid PayPal webhook signature.');
        }

        /** @var array<string,mixed> $event */
        $event = json_decode($payload, true, 512, JSON_THROW_ON_ERROR);
        $type = (string) ($event['event_type'] ?? '');
        $eventId = (string) ($event['id'] ?? '');
        $resource = (array) ($event['resource'] ?? []);

        if ($eventId === '') {
            throw new RuntimeException('PayPal webhook payload is missing event ID.');
        }

        $paypalOrderId = (string) ($resource['supplementary_data']['related_ids']['order_id'] ?? '');

        if ($paypalOrderId === '') {
            // Refund/dispute events reference the capture, not the order — walk the capture's own links to find it.
            $paypalOrderId = (string) ($resource['id'] ?? '');
        }

        $order = Order::query()->where('meta->paypal_order_id', $paypalOrderId)->first();
        $eventRecord = $this->captureWebhookEvent($eventId, $type, $paypalOrderId, $order?->id, $event);

        if (! $eventRecord['created']) {
            return [
                'processed' => false,
                'reason' => 'duplicate_event',
                'event_type' => $type,
                'event_id' => $eventId,
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
            ];
        }

        $paymentStatus = match ($type) {
            'PAYMENT.CAPTURE.COMPLETED' => 'paid',
            'PAYMENT.CAPTURE.DENIED' => 'failed',
            'PAYMENT.CAPTURE.REFUNDED' => 'refunded',
            default => null,
        };

        if ($paymentStatus !== null) {
            $this->orderOperationsService->syncPayPalPayment($order, [
                'payment_status' => $paymentStatus,
                'event_type' => $type,
                'event_id' => $eventId,
                'payer_email' => $resource['payer']['email_address'] ?? null,
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
     * @return array{created: bool, model: PayPalWebhookEvent}
     */
    private function captureWebhookEvent(string $eventId, string $type, string $paypalOrderId, ?int $orderId, array $event): array
    {
        $existing = PayPalWebhookEvent::query()->where('event_id', $eventId)->first();

        if ($existing) {
            return [
                'created' => false,
                'model' => $existing,
            ];
        }

        try {
            $created = PayPalWebhookEvent::query()->create([
                'event_id' => $eventId,
                'event_type' => $type,
                'paypal_order_id' => $paypalOrderId,
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
                'model' => PayPalWebhookEvent::query()->where('event_id', $eventId)->firstOrFail(),
            ];
        }

        return [
            'created' => true,
            'model' => $created,
        ];
    }
}
