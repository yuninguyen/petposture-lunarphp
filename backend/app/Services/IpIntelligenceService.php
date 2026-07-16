<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Looks up geolocation/ISP/connection-type data for an IP via ip-api.com's
 * free tier (no API key, HTTP only). Used to enrich the admin order view
 * with where a checkout actually came from.
 */
class IpIntelligenceService
{
    public function lookup(string $ip): ?array
    {
        if ($this->isPrivateOrReserved($ip)) {
            return null;
        }

        try {
            $response = Http::timeout(3)->get("http://ip-api.com/json/{$ip}", [
                'fields' => 'status,country,regionName,city,isp,org,mobile,proxy,hosting',
            ]);
        } catch (\Throwable $e) {
            Log::warning('IP intelligence lookup failed: ' . $e->getMessage());

            return null;
        }

        if (! $response->successful() || $response->json('status') !== 'success') {
            return null;
        }

        $data = $response->json();

        return [
            'location' => collect([$data['city'] ?? null, $data['regionName'] ?? null, $data['country'] ?? null])
                ->filter()
                ->implode(', '),
            'isp' => $data['isp'] ?? $data['org'] ?? null,
            'service_type' => $this->resolveServiceType($data),
        ];
    }

    private function resolveServiceType(array $data): string
    {
        if (! empty($data['hosting'])) {
            return 'Hosting / Datacenter';
        }

        if (! empty($data['proxy'])) {
            return 'Proxy / VPN';
        }

        if (! empty($data['mobile'])) {
            return 'Mobile Carrier';
        }

        return 'Residential / Business';
    }

    private function isPrivateOrReserved(string $ip): bool
    {
        return ! filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE);
    }
}
