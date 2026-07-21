<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class AfterShipService
{
    /**
     * Carrier slugs already used across the app (OrderController::SHIPMENT_CARRIERS)
     * map 1:1 onto AfterShip's own slugs for these four, so no translation needed.
     */
    private const SUPPORTED_SLUGS = ['ups', 'usps', 'fedex', 'dhl'];

    private function apiKey(): string
    {
        return (string) config('services.aftership.api_key');
    }

    public function isConfigured(): bool
    {
        return filled($this->apiKey());
    }

    /**
     * Registers a shipment with AfterShip so it starts polling the carrier and
     * fires our webhook when the status changes (including "delivered").
     * Silently no-ops if AfterShip isn't configured or the carrier is "manual"
     * (nothing a public carrier API can track).
     */
    public function createTracking(string $trackingNumber, ?string $carrierSlug): void
    {
        if (! $this->isConfigured() || $trackingNumber === '') {
            return;
        }

        $slug = in_array($carrierSlug, self::SUPPORTED_SLUGS, true) ? $carrierSlug : null;

        try {
            $response = Http::withHeaders(['as-api-key' => $this->apiKey()])
                ->post('https://api.aftership.com/v4/trackings', [
                    'tracking' => array_filter([
                        'tracking_number' => $trackingNumber,
                        'slug' => $slug,
                    ]),
                ]);

            if (! $response->successful()) {
                Log::warning('AfterShip tracking registration failed', [
                    'tracking_number' => $trackingNumber,
                    'carrier' => $carrierSlug,
                    'status' => $response->status(),
                    'body' => $response->body(),
                ]);
            }
        } catch (\Throwable $e) {
            Log::warning('AfterShip tracking registration threw an exception', [
                'tracking_number' => $trackingNumber,
                'carrier' => $carrierSlug,
                'message' => $e->getMessage(),
            ]);
        }
    }

    public function verifyWebhookSignature(string $rawBody, ?string $signature): bool
    {
        $secret = (string) config('services.aftership.webhook_secret');

        if (! $secret || ! $signature) {
            return false;
        }

        $expected = base64_encode(hash_hmac('sha256', $rawBody, $secret, true));

        return hash_equals($expected, $signature);
    }
}
