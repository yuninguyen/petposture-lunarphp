<?php

namespace App\Services\Affiliate\Drivers;

use App\Models\AffiliateNetwork;
use App\Services\Affiliate\Contracts\AffiliateNetworkDriverInterface;
use Illuminate\Support\Carbon;
use RuntimeException;

/**
 * Impact.com driver — used for Walmart per the confirmed retailer/network
 * mapping (2026-08-05). No Impact API access has been verified against live
 * documentation this session. fetchReport() only supports placeholder mode
 * until someone implements and verifies the real request against Impact
 * own API reference and a real Impact account with API credentials.
 */
class ImpactDriver implements AffiliateNetworkDriverInterface
{
    public function __construct(
        private readonly AffiliateNetwork $network,
    ) {}

    public function fetchReport(Carbon $start, Carbon $end): array
    {
        if (! $this->network->isApiConfigured()) {
            return ['clicks' => 0, 'conversions' => 0, 'commission' => 0.0, 'mode' => 'placeholder'];
        }

        throw new RuntimeException('ImpactDriver: real Impact.com API request is not implemented yet — verify against the live API reference before enabling this network.');
    }
}
