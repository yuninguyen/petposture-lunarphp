<?php

namespace App\Services\Affiliate\Drivers;

use App\Models\AffiliateNetwork;
use App\Services\Affiliate\Contracts\AffiliateNetworkDriverInterface;
use Illuminate\Support\Carbon;
use RuntimeException;

/**
 * CJ (Commission Junction) driver — used for Petco/PetSmart per the
 * confirmed retailer/network mapping (2026-08-05). No CJ API access has
 * been verified against live documentation this session. fetchReport()
 * only supports placeholder mode until someone implements and verifies
 * the real request against CJ's own API reference and a real CJ account
 * with API credentials.
 */
class CjDriver implements AffiliateNetworkDriverInterface
{
    public function __construct(
        private readonly AffiliateNetwork $network,
    ) {}

    public function fetchReport(Carbon $start, Carbon $end): array
    {
        if (! $this->network->isApiConfigured()) {
            return ['clicks' => 0, 'conversions' => 0, 'commission' => 0.0, 'mode' => 'placeholder'];
        }

        throw new RuntimeException('CjDriver: real CJ API request is not implemented yet — verify against the live API reference before enabling this network.');
    }
}
