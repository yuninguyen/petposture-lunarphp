<?php

namespace App\Services;

use App\Models\ShippingMethod;

class ShippingService
{
    private const METHODS = ['standard', 'express'];

    /**
     * All available shipping methods with computed prices for the given subtotal.
     */
    public function availableMethods(int $subtotalMinor = 0, bool $isFreeShipping = false): array
    {
        return array_map(
            fn(string $code) => $this->build($code, $subtotalMinor, $isFreeShipping),
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

        $shippingMethod = $this->methodByCode($method);

        if (! $shippingMethod) {
            return 0;
        }

        $freeOverMinor = $shippingMethod->free_over !== null ? (int) round($shippingMethod->free_over * 100) : 0;

        if ($method === 'standard' && $freeOverMinor > 0 && $subtotalMinor >= $freeOverMinor) {
            return 0;
        }

        return (int) round($shippingMethod->price * 100);
    }

    // ─── Private ─────────────────────────────────────────────────────────────

    private function methodByCode(string $code): ?ShippingMethod
    {
        return ShippingMethod::query()->where('code', $code)->first();
    }

    private function build(string $code, int $subtotalMinor, bool $isFreeShipping): array
    {
        $shippingMethod = $this->methodByCode($code);
        $priceMinor = $this->rateFor($code, $subtotalMinor, $isFreeShipping);
        $freeOverMinor = $shippingMethod?->free_over !== null ? (int) round($shippingMethod->free_over * 100) : null;

        return [
            'id'              => $code,
            'name'            => $shippingMethod->name ?? ucfirst($code) . ' Shipping',
            'description'     => $shippingMethod->eta ?? '',
            'eta'             => $shippingMethod->eta ?? '',
            'price_minor'     => $priceMinor,
            'price'           => round($priceMinor / 100, 2),
            'free_over_minor' => $code === 'standard' ? $freeOverMinor : null,
            'free_over'       => ($code === 'standard' && $freeOverMinor) ? round($freeOverMinor / 100, 2) : null,
        ];
    }
}
