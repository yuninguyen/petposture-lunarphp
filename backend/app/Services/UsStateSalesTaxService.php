<?php

namespace App\Services;

class UsStateSalesTaxService
{
    public function resolveStateCode(?string $stateInput): ?string
    {
        $state = strtoupper(trim((string) $stateInput));

        if (! $state) {
            return null;
        }

        $rates = config('us_state_sales_tax.state_rates', []);

        if (array_key_exists($state, $rates)) {
            return $state;
        }

        $names = config('us_state_sales_tax.names', []);

        return $names[$state] ?? null;
    }

    public function getRateForState(?string $stateInput, ?string $countryInput = null): float
    {
        $breakdown = $this->getBreakdownForState($stateInput, $countryInput);

        return $breakdown['combined_rate'];
    }

    public function getBreakdownForState(?string $stateInput, ?string $countryInput = null): array
    {
        $country = strtoupper(trim((string) $countryInput));

        if ($country && ! in_array($country, ['US', 'USA', 'UNITED STATES'], true)) {
            return [
                'state_rate' => 0.0,
                'avg_local_rate' => 0.0,
                'combined_rate' => 0.0,
            ];
        }

        $stateCode = $this->resolveStateCode($stateInput);

        if (! $stateCode) {
            return [
                'state_rate' => 0.0,
                'avg_local_rate' => 0.0,
                'combined_rate' => 0.0,
            ];
        }

        $stateRate = (float) (config("us_state_sales_tax.state_rates.{$stateCode}") ?? 0.0);
        $avgLocalRate = (float) (config("us_state_sales_tax.avg_local_rates.{$stateCode}") ?? 0.0);

        return [
            'state_rate' => $stateRate,
            'avg_local_rate' => $avgLocalRate,
            'combined_rate' => round($stateRate + $avgLocalRate, 4),
        ];
    }
}
