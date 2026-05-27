<?php

namespace App\Services;

use App\Models\Setting;

class ShippingService
{
    private const METHODS = ['standard', 'express'];

    private const DEFAULTS = [
        'standard' => ['price_minor' => 0,    'eta' => '5-7 business days', 'name' => 'Standard Shipping'],
        'express'  => ['price_minor' => 2500,  'eta' => '1-2 business days', 'name' => 'Express Shipping'],
    ];

    /**
     * All available shipping methods with computed prices for the given subtotal.
     */
    public function availableMethods(int $subtotalMinor = 0, bool $isFreeShipping = false): array
    {
        $freeOverMinor = $this->freeOverMinor();

        return array_map(
            fn(string $m) => $this->build($m, $subtotalMinor, $isFreeShipping, $freeOverMinor),
            self::METHODS,
        );
    }

    /**
     * Price in minor units for a specific method.
     */
    public function rateFor(string $method, int $subtotalMinor = 0, bool $isFreeShipping = false): int
    {
        if ($isFreeShipping) {
            return 0;
        }

        $freeOverMinor = $this->freeOverMinor();

        if ($method === 'standard' && $freeOverMinor > 0 && $subtotalMinor >= $freeOverMinor) {
            return 0;
        }

        $raw = Setting::get("shipping_{$method}_price_minor");

        return $raw !== null ? (int) $raw : (int) (self::DEFAULTS[$method]['price_minor'] ?? 0);
    }

    // ─── Private ─────────────────────────────────────────────────────────────

    private function freeOverMinor(): int
    {
        $raw = Setting::get('shipping_free_over_minor');

        return $raw !== null ? (int) $raw : 0;
    }

    private function build(string $method, int $subtotalMinor, bool $isFreeShipping, int $freeOverMinor): array
    {
        $priceMinor = $this->rateFor($method, $subtotalMinor, $isFreeShipping);
        $eta = (string) (Setting::get("shipping_{$method}_eta") ?? self::DEFAULTS[$method]['eta']);

        return [
            'id'              => $method,
            'name'            => self::DEFAULTS[$method]['name'],
            'description'     => $eta,
            'eta'             => $eta,
            'price_minor'     => $priceMinor,
            'price'           => round($priceMinor / 100, 2),
            'free_over_minor' => ($method === 'standard' && $freeOverMinor > 0) ? $freeOverMinor : null,
            'free_over'       => ($method === 'standard' && $freeOverMinor > 0) ? round($freeOverMinor / 100, 2) : null,
        ];
    }
}
