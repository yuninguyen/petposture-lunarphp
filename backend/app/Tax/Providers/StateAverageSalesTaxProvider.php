<?php

namespace App\Tax\Providers;

use App\Tax\Contracts\SalesTaxProviderInterface;
use App\Services\UsStateSalesTaxService;

class StateAverageSalesTaxProvider implements SalesTaxProviderInterface
{
    public function __construct(
        private readonly UsStateSalesTaxService $stateSalesTaxService,
    ) {
    }

    public function quote(array $address, int $taxableAmount): array
    {
        $breakdown = $this->stateSalesTaxService->getBreakdownForState(
            $address['state'] ?? null,
            $address['country'] ?? 'US',
        );

        $taxableAmount = max(0, $taxableAmount);
        $taxAmount = (int) round($taxableAmount * (($breakdown['combined_rate'] ?? 0) / 100));
        $source = config('us_state_sales_tax.source', []);

        return [
            'state_code' => $this->stateSalesTaxService->resolveStateCode($address['state'] ?? null),
            'state_rate_percentage' => (float) ($breakdown['state_rate'] ?? 0),
            'avg_local_rate_percentage' => (float) ($breakdown['avg_local_rate'] ?? 0),
            'rate_percentage' => (float) ($breakdown['combined_rate'] ?? 0),
            'tax_amount' => $taxAmount,
            'provider' => 'state-average',
            'is_estimate' => true,
            'source_label' => $source['label'] ?? 'State average sales tax table',
            'source_url' => $source['url'] ?? null,
            'effective_date' => $source['effective_date'] ?? null,
        ];
    }
}
