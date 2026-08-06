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
 * PingPong Acquiring "Redirect Checkout" integration (verified against
 * https://acquirer-api-docs-v4-en.pingpongx.com/en/notes/integrate/link/ at
 * plan time): prePay request fields and the paymentUrl redirect target are
 * confirmed by that doc. The exact base host and RSA-signing wire format
 * (canonical param ordering) were not fully spelled out there, so those two
 * details are a best-effort reconstruction — confirm against the "Signature
 * Guide" page and your merchant onboarding docs before PINGPONG_MODE=live.
 */
class PingPongService
{
    public function __construct(
        private readonly OrderOperationsService $orderOperationsService,
    ) {}

    private function appId(): string
    {
        return Cache::remember('pingpong_app_id', 300, fn () => Setting::get('pingpong_app_id') ?: (string) config('services.pingpong.app_id')
        );
    }

    private function privateKey(): string
    {
        return Cache::remember('pingpong_private_key', 300, fn () => Setting::get('pingpong_private_key') ?: (string) config('services.pingpong.private_key')
        );
    }

    private function publicKey(): string
    {
        return Cache::remember('pingpong_public_key', 300, fn () => Setting::get('pingpong_public_key') ?: (string) config('services.pingpong.public_key')
        );
    }

    private function mode(): string
    {
        return Cache::remember('pingpong_mode', 300, fn () => Setting::get('pingpong_mode') ?: (string) config('services.pingpong.mode', 'sandbox')
        );
    }

    public function isConfigured(): bool
    {
        return filled($this->appId()) && filled($this->privateKey());
    }

    private function baseUrl(): string
    {
        return $this->mode() === 'live'
            ? 'https://acquirer.pingpongx.com'
            : 'https://sandbox-acquirer.pingpongx.com';
    }

    /**
     * Signs a flat param array: sort keys, join as "key=value&...", RSA-SHA256
     * sign with the merchant private key, base64-encode.
     */
    private function sign(array $params): string
    {
        ksort($params);
        $canonical = collect($params)
            ->map(fn ($value, $key) => "{$key}={$value}")
            ->implode('&');

        $privateKey = openssl_pkey_get_private($this->privateKey());

        if (! $privateKey) {
            throw new RuntimeException('Invalid PingPong private key.');
        }

        openssl_sign($canonical, $signature, $privateKey, OPENSSL_ALGO_SHA256);

        return base64_encode($signature);
    }

    private function verifySignature(array $params, string $signature): bool
    {
        $publicKey = $this->publicKey();

        if ($publicKey === '') {
            return true;
        }

        ksort($params);
        $canonical = collect($params)
            ->map(fn ($value, $key) => "{$key}={$value}")
            ->implode('&');

        $key = openssl_pkey_get_public($publicKey);

        if (! $key) {
            return false;
        }

        return openssl_verify($canonical, base64_decode($signature), $key, OPENSSL_ALGO_SHA256) === 1;
    }

    private function minorToDecimal(int $amountMinor): string
    {
        return number_format($amountMinor / 100, 2, '.', '');
    }

    public function createCheckoutSession(int $amountMinor, string $currency, string $orderReference, string $returnUrl, string $shopperIp): array
    {
        if (! $this->isConfigured()) {
            return [
                'session_id' => 'PINGPONG-PLACEHOLDER-'.Str::upper(Str::random(14)),
                'checkout_url' => $returnUrl,
                'mode' => 'placeholder',
            ];
        }

        $params = [
            'appId' => $this->appId(),
            'amount' => $this->minorToDecimal($amountMinor),
            'currency' => strtoupper($currency),
            'merchantTransactionId' => $orderReference,
            'merchantUserId' => $orderReference,
            'shopperIP' => $shopperIp ?: '0.0.0.0',
            'notificationUrl' => url('/api/webhooks/pingpong'),
            'payResultUrl' => $returnUrl,
        ];

        $response = Http::asJson()
            ->post($this->baseUrl().'/v4/prePay', [
                ...$params,
                'sign' => $this->sign($params),
            ]);

        if (! $response->successful()) {
            throw new RuntimeException(
                $response->json('message') ?? 'PingPong checkout session creation failed.'
            );
        }

        $checkoutUrl = (string) $response->json('paymentUrl');

        if ($checkoutUrl === '') {
            throw new RuntimeException('PingPong response did not include a paymentUrl.');
        }

        return [
            'session_id' => (string) ($response->json('paymentRequestId') ?? $orderReference),
            'checkout_url' => $checkoutUrl,
            'mode' => 'configured',
        ];
    }

    public function handleWebhook(array $payload): array
    {
        $signature = (string) ($payload['sign'] ?? '');
        $params = $payload;
        unset($params['sign']);

        if (! $this->verifySignature($params, $signature)) {
            throw new RuntimeException('Invalid PingPong webhook signature.');
        }

        $eventId = (string) ($payload['paymentRequestId'] ?? $payload['merchantTransactionId'] ?? '');
        $orderReference = (string) ($payload['merchantTransactionId'] ?? '');
        $status = (string) ($payload['status'] ?? $payload['tradeStatus'] ?? '');

        if ($eventId === '') {
            throw new RuntimeException('PingPong webhook payload is missing a transaction ID.');
        }

        $order = $orderReference !== ''
            ? Order::query()->where('reference', $orderReference)->first()
            : null;

        $eventRecord = $this->captureWebhookEvent($eventId, $status, $orderReference, $order?->id, $payload);

        if (! $eventRecord['created']) {
            return ['processed' => false, 'reason' => 'duplicate_event', 'event_type' => $status, 'event_id' => $eventId];
        }

        if (! $order) {
            $eventRecord['model']->update(['status' => 'orphaned', 'processed_at' => now()]);

            return ['processed' => false, 'reason' => 'order_not_found', 'event_type' => $status, 'event_id' => $eventId];
        }

        $paymentStatus = match (strtoupper($status)) {
            'SUCCESS', 'PAID' => 'paid',
            'FAILED' => 'failed',
            'CANCELLED', 'CLOSED' => 'cancelled',
            default => null,
        };

        if ($paymentStatus !== null) {
            $this->orderOperationsService->syncRedirectGatewayPayment($order, 'PingPong', [
                'payment_status' => $paymentStatus,
                'event_type' => $status,
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
            'event_type' => $status,
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
        $existing = PaymentWebhookEvent::query()->where('gateway', 'pingpong')->where('event_id', $eventId)->first();

        if ($existing) {
            return ['created' => false, 'model' => $existing];
        }

        try {
            $created = PaymentWebhookEvent::query()->create([
                'gateway' => 'pingpong',
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
                'model' => PaymentWebhookEvent::query()->where('gateway', 'pingpong')->where('event_id', $eventId)->firstOrFail(),
            ];
        }

        return ['created' => true, 'model' => $created];
    }
}
