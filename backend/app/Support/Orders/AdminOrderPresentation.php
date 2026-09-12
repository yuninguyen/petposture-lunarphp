<?php

namespace App\Support\Orders;

use Illuminate\Support\Str;

final class AdminOrderPresentation
{
    public static function paymentMethod(array $meta): string
    {
        $method = strtolower(trim((string) ($meta['payment_method'] ?? '')));

        if ($method === 'card') {
            $funding = strtolower(trim((string) ($meta['card_funding'] ?? '')));
            $cardType = match ($funding) {
                'credit' => 'Credit Card',
                'debit' => 'Debit Card',
                'prepaid' => 'Prepaid Card',
                default => 'Card',
            };

            $brand = trim((string) ($meta['card_brand'] ?? ''));
            $last4 = trim((string) ($meta['card_last4'] ?? ''));

            if ($brand !== '') {
                $brandHeadline = Str::headline($brand);
                $label = "{$cardType} - {$brandHeadline}";

                return $last4 !== '' ? "{$label} •••• {$last4}" : $label;
            }

            return $last4 !== '' ? "{$cardType} •••• {$last4}" : $cardType;
        }

        if ($method === 'paypal') {
            $email = trim((string) ($meta['paypal_payer_email'] ?? ''));

            return $email !== '' ? "PayPal ({$email})" : 'PayPal';
        }

        if ($method === 'cod') {
            return 'COD';
        }

        if ($method !== '') {
            return Str::headline($method);
        }

        return '—';
    }

    public static function money(mixed $amount, ?string $currencyCode = 'USD'): string
    {
        $currency = strtoupper(trim((string) ($currencyCode ?: 'USD')));
        if ($currency === '') {
            $currency = 'USD';
        }

        if ($amount === null) {
            return '—';
        }

        if (is_object($amount)) {
            if (isset($amount->value) && is_numeric($amount->value)) {
                $decimal = ((float) $amount->value) / 100;
            } elseif (method_exists($amount, 'decimal')) {
                $decimal = (float) $amount->decimal();
            } elseif (property_exists($amount, 'decimal') && is_numeric($amount->decimal)) {
                $decimal = (float) $amount->decimal;
            } else {
                $decimal = 0.0;
            }

            if (empty($currencyCode) && isset($amount->currency?->code)) {
                $currency = strtoupper(trim((string) $amount->currency->code));
            }
        } elseif (is_float($amount)) {
            $decimal = $amount;
        } elseif (is_numeric($amount)) {
            if (is_string($amount) && str_contains($amount, '.')) {
                $decimal = (float) $amount;
            } else {
                $decimal = ((float) $amount) / 100;
            }
        } else {
            return '—';
        }

        $symbol = match ($currency) {
            'EUR' => '€',
            'GBP' => '£',
            default => '$',
        };

        return sprintf('%s %s%01.2f', $currency, $symbol, $decimal);
    }

    public static function productQuantity(iterable $lines): int
    {
        $total = 0;

        foreach ($lines as $line) {
            $type = is_array($line) ? ($line['type'] ?? null) : ($line->type ?? null);

            if ($type === 'shipping') {
                continue;
            }

            $quantity = is_array($line) ? ($line['quantity'] ?? 0) : ($line->quantity ?? 0);
            $total += max(0, (int) $quantity);
        }

        return $total;
    }
}
