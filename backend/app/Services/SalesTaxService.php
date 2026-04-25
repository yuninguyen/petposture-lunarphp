<?php

namespace App\Services;

use App\Tax\Providers\StateAverageSalesTaxProvider;
use App\Tax\Providers\StripeTaxSalesTaxProvider;
use Throwable;

class SalesTaxService
{
    public function __construct(
        private readonly StateAverageSalesTaxProvider $stateAverageProvider,
        private readonly StripeTaxSalesTaxProvider $stripeTaxProvider,
    ) {
    }

    public function quote(array $address, int $taxableAmount): array
    {
        $provider = (string) config('commerce.tax.provider', 'state-average');
        $fallback = (string) config('commerce.tax.fallback_provider', 'state-average');

        try {
            return $this->withResolutionMeta(
                $this->provider($provider)->quote($address, $taxableAmount),
                $provider,
                null,
                null,
            );
        } catch (Throwable $exception) {
            if ($fallback === $provider) {
                return $this->withResolutionMeta(
                    $this->provider('state-average')->quote($address, $taxableAmount),
                    $provider,
                    'state-average',
                    $exception->getMessage(),
                );
            }

            return $this->withResolutionMeta(
                $this->provider($fallback)->quote($address, $taxableAmount),
                $provider,
                $fallback,
                $exception->getMessage(),
            );
        }
    }

    private function provider(string $name): StateAverageSalesTaxProvider|StripeTaxSalesTaxProvider
    {
        return match ($name) {
            'stripe-tax' => $this->stripeTaxProvider,
            default => $this->stateAverageProvider,
        };
    }

    private function withResolutionMeta(
        array $quote,
        string $requestedProvider,
        ?string $fallbackProvider,
        ?string $fallbackReason,
    ): array {
        $quote['provider_requested'] = $requestedProvider;
        $quote['provider_fallback_applied'] = $fallbackProvider !== null;
        $quote['provider_fallback'] = $fallbackProvider;
        $quote['provider_fallback_reason'] = $fallbackReason;

        return $quote;
    }
}
