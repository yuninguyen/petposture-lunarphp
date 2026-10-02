<?php

namespace App\Services;

use App\Models\Setting;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Read-only view of which payment methods are switched on in the Stripe
 * dashboard (the default PaymentMethodConfiguration). It never changes anything
 * on the Stripe account, and any failure degrades to "unknown" so checkout keeps
 * working without Stripe's answer.
 */
class StripePaymentMethodStatusService
{
    public const CACHE_KEY = 'stripe_payment_method_status';

    /** Our method key => the key Stripe uses in its PaymentMethodConfiguration object. */
    public const STRIPE_KEYS = [
        'card' => 'card',
        'google_pay' => 'google_pay',
        'apple_pay' => 'apple_pay',
        'affirm' => 'affirm',
        'afterpay_clearpay' => 'afterpay_clearpay',
        'klarna' => 'klarna',
        'cashapp' => 'cashapp',
        'amazon_pay' => 'amazon_pay',
        'ach_debit' => 'us_bank_account',
    ];

    /**
     * @return array{statuses: array<string, string>, ok: bool, checked_at: string|null}
     */
    public function snapshot(): array
    {
        $unknown = ['statuses' => [], 'ok' => false, 'checked_at' => null];

        if (! config('services.stripe.method_status_sync', true)) {
            return $unknown;
        }

        $secret = $this->secret();
        if ($secret === '') {
            return $unknown;
        }

        $cached = Cache::get(self::CACHE_KEY);
        if (is_array($cached)) {
            return $cached;
        }

        $snapshot = $this->fetch($secret) ?? $unknown;
        // A failed lookup is retried soon, but not on every request.
        Cache::put(self::CACHE_KEY, $snapshot, $snapshot['ok'] ? 120 : 30);

        return $snapshot;
    }

    /** 'on', 'off', 'unavailable', or null when Stripe's answer is unknown. */
    public function status(string $method): ?string
    {
        return $this->snapshot()['statuses'][$method] ?? null;
    }

    /** Whether Stripe says the method must not be offered. */
    public function isBlocked(string $method): bool
    {
        return in_array($this->status($method), ['off', 'unavailable'], true);
    }

    /**
     * @return array{statuses: array<string, string>, ok: bool, checked_at: string|null}
     */
    public function refresh(): array
    {
        Cache::forget(self::CACHE_KEY);

        return $this->snapshot();
    }

    /**
     * @return array{statuses: array<string, string>, ok: bool, checked_at: string|null}|null
     */
    private function fetch(string $secret): ?array
    {
        try {
            $response = Http::withBasicAuth($secret, '')
                ->timeout(5)
                ->get('https://api.stripe.com/v1/payment_method_configurations', ['limit' => 100]);
        } catch (Throwable $exception) {
            Log::warning('Stripe payment method status lookup failed: '.$exception->getMessage());

            return null;
        }

        if (! $response->successful()) {
            Log::warning('Stripe payment method status lookup returned HTTP '.$response->status());

            return null;
        }

        $configs = collect($response->json('data') ?? []);
        $config = $configs->firstWhere('is_default', true) ?? $configs->firstWhere('active', true);
        if (! is_array($config)) {
            return null;
        }

        $statuses = [];
        foreach (self::STRIPE_KEYS as $method => $stripeKey) {
            $entry = $config[$stripeKey] ?? null;
            if (! is_array($entry)) {
                continue;
            }

            $statuses[$method] = ($entry['available'] ?? true) === false
                ? 'unavailable'
                : (($entry['display_preference']['value'] ?? 'on') === 'off' ? 'off' : 'on');
        }

        return ['statuses' => $statuses, 'ok' => true, 'checked_at' => now()->toIso8601String()];
    }

    private function secret(): string
    {
        // Same DB-first resolution (and cache key) as the other Stripe classes.
        return (string) Cache::remember('stripe_secret', 300, fn () => Setting::get('stripe_secret') ?: (string) config('services.stripe.secret'));
    }
}
