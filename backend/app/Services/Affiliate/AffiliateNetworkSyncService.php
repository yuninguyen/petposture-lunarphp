<?php

namespace App\Services\Affiliate;

use App\Models\AffiliateNetwork;
use App\Models\AffiliateReport;
use App\Services\Affiliate\Contracts\AffiliateNetworkDriverInterface;
use App\Services\Affiliate\Drivers\AmazonPaApiDriver;
use App\Services\Affiliate\Drivers\CjDriver;
use App\Services\Affiliate\Drivers\ImpactDriver;
use Illuminate\Support\Carbon;
use RuntimeException;

class AffiliateNetworkSyncService
{
    public function sync(AffiliateNetwork $network, Carbon $date): AffiliateReport
    {
        $driver = $this->resolveDriver($network);
        $result = $driver->fetchReport($date->clone()->startOfDay(), $date->clone()->endOfDay());

        $report = AffiliateReport::query()->updateOrCreate(
            [
                'affiliate_network_id' => $network->id,
                'date' => $date->toDateString(),
            ],
            [
                'clicks' => $result['clicks'],
                'conversions' => $result['conversions'],
                'commission_amount' => number_format($result['commission'], 2, '.', ''),
                'synced_at' => now(),
            ]
        );

        $network->update(['last_synced_at' => now()]);

        return $report;
    }

    private function resolveDriver(AffiliateNetwork $network): AffiliateNetworkDriverInterface
    {
        return match ($network->provider) {
            'amazon_pa_api' => new AmazonPaApiDriver($network),
            'impact' => new ImpactDriver($network),
            'cj' => new CjDriver($network),
            default => throw new RuntimeException("No sync driver configured for affiliate network [{$network->slug}]."),
        };
    }
}
