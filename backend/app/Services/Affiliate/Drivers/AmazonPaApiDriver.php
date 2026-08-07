<?php

namespace App\Services\Affiliate\Drivers;

use App\Models\AffiliateNetwork;
use App\Services\Affiliate\Contracts\AffiliateNetworkDriverInterface;
use Illuminate\Support\Carbon;
use RuntimeException;

/**
 * Amazon Product Advertising API 5.0 driver. No PA API access has been
 * verified against live documentation this session (unlike the PingPong
 * payment-gateway driver built earlier) — PA API additionally requires an
 * Associates account with qualifying sales before it grants continued API
 * access, which this project does not have yet. fetchReport() therefore
 * only supports placeholder mode until someone implements and verifies the
 * real signed request (AWS Signature V4) against the actual API reference.
 */
class AmazonPaApiDriver implements AffiliateNetworkDriverInterface
{
    public function __construct(
        private readonly AffiliateNetwork $network,
    ) {}

    public function fetchReport(Carbon $start, Carbon $end): array
    {
        if (! $this->network->isApiConfigured()) {
            return ['clicks' => 0, 'conversions' => 0, 'commission' => 0.0, 'mode' => 'placeholder'];
        }

        throw new RuntimeException('AmazonPaApiDriver: real Product Advertising API 5.0 request is not implemented yet — verify against the live API reference before enabling this network.');
    }
}
