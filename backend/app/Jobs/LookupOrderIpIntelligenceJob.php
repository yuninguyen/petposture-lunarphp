<?php

namespace App\Jobs;

use App\Services\IpIntelligenceService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Lunar\Models\Order;

class LookupOrderIpIntelligenceJob implements ShouldQueue
{
    use Dispatchable;
    use InteractsWithQueue;
    use Queueable;
    use SerializesModels;

    public function __construct(
        public readonly int $orderId,
        public readonly string $ip,
    ) {
        $this->afterCommit = true;
    }

    public function handle(IpIntelligenceService $ipIntelligenceService): void
    {
        $order = Order::query()->find($this->orderId);

        if (! $order) {
            return;
        }

        $ipInfo = $ipIntelligenceService->lookup($this->ip);

        if (! $ipInfo) {
            return;
        }

        $meta = (array) ($order->meta ?? []);
        $meta['customer_ip_location'] = $ipInfo['location'];
        $meta['customer_ip_isp'] = $ipInfo['isp'];
        $meta['customer_ip_service_type'] = $ipInfo['service_type'];

        $order->update(['meta' => $meta]);
    }
}
