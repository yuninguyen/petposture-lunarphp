<?php

namespace App\Services\Affiliate\Contracts;

use Illuminate\Support\Carbon;

interface AffiliateNetworkDriverInterface
{
    /**
     * @return array{clicks: int, conversions: int, commission: float, mode: string}
     */
    public function fetchReport(Carbon $start, Carbon $end): array;
}
