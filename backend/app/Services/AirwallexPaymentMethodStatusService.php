<?php

namespace App\Services;

use Illuminate\Support\Facades\Cache;

/**
 * Read-only view of which payment methods the Airwallex account can offer. It never
 * changes anything on the Airwallex account, and any failure degrades to "unknown".
 * The storefront does not sell through Airwallex yet, so this only feeds the admin.
 */
class AirwallexPaymentMethodStatusService
{
    public const CACHE_KEY = 'airwallex_payment_method_status';

    /** Our admin method key => the payment method type name Airwallex uses. */
    public const AIRWALLEX_NAMES = [
        'airwallex_card' => 'card',
        'airwallex_ach_debit' => 'ach_direct_debit',
        'airwallex_affirm' => 'affirm',
        'airwallex_afterpay_clearpay' => 'afterpay',
        'airwallex_apple_pay' => 'applepay',
        'airwallex_cashapp' => 'cashapp',
        'airwallex_google_pay' => 'googlepay',
        'airwallex_klarna' => 'klarna',
        'airwallex_venmo' => 'venmo',
        'airwallex_paypal' => 'paypal',
    ];

    public function __construct(private readonly AirwallexService $airwallex) {}

    /**
     * @return array{statuses: array<string, string>, ok: bool, checked_at: string|null}
     */
    public function snapshot(): array
    {
        $unknown = ['statuses' => [], 'ok' => false, 'checked_at' => null];

        if (! config('services.airwallex.method_status_sync', true) || ! $this->airwallex->isConfigured()) {
            return $unknown;
        }

        $cached = Cache::get(self::CACHE_KEY);
        if (is_array($cached)) {
            return $cached;
        }

        $snapshot = $this->fetch() ?? $unknown;
        // A failed lookup is retried soon, but not on every request.
        Cache::put(self::CACHE_KEY, $snapshot, $snapshot['ok'] ? 120 : 30);

        return $snapshot;
    }

    /** 'on', 'off', 'unavailable' (the account is not offered this method), or null when unknown. */
    public function status(string $method): ?string
    {
        return $this->snapshot()['statuses'][$method] ?? null;
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
    private function fetch(): ?array
    {
        $items = $this->airwallex->paymentMethodTypes();
        if ($items === null) {
            return null;
        }

        $statuses = [];
        foreach (self::AIRWALLEX_NAMES as $method => $name) {
            $entries = array_filter($items, static fn ($item): bool => is_array($item) && ($item['name'] ?? null) === $name);

            $statuses[$method] = $entries === []
                ? 'unavailable'
                : (collect($entries)->contains(static fn (array $item): bool => ($item['active'] ?? false) === true) ? 'on' : 'off');
        }

        return ['statuses' => $statuses, 'ok' => true, 'checked_at' => now()->toIso8601String()];
    }
}
