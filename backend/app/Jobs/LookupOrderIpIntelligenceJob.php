<?php

namespace App\Jobs;

use App\Services\IpIntelligenceService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\DB;
use Lunar\Models\Order;

class LookupOrderIpIntelligenceJob implements ShouldQueue
{
    use Dispatchable;
    use InteractsWithQueue;
    use Queueable;
    use SerializesModels;

    // Runs once right after checkout and once more later (see handle()).
    private const MAX_ATTEMPTS = 2;

    public function __construct(
        public readonly int $orderId,
        public readonly string $ip,
        public readonly int $attempt = 1,
    ) {
        $this->afterCommit = true;
    }

    public function handle(IpIntelligenceService $ipIntelligenceService): void
    {
        $order = Order::query()->find($this->orderId);

        if (! $order) {
            return;
        }

        // Already enriched (and not wiped since): nothing to do.
        if (! empty(((array) ($order->meta ?? []))['customer_ip_location'])) {
            return;
        }

        $ipInfo = $ipIntelligenceService->lookup($this->ip);

        if ($ipInfo) {
            // Re-read under a row lock so this write merges into the current meta instead of replacing a
            // newer one (the payment webhook updates the same column seconds after checkout).
            DB::transaction(function () use ($ipInfo): void {
                $locked = Order::query()->lockForUpdate()->find($this->orderId);

                if (! $locked) {
                    return;
                }

                $meta = (array) ($locked->meta ?? []);
                $meta['customer_ip_location'] = $ipInfo['location'];
                $meta['customer_ip_isp'] = $ipInfo['isp'];
                $meta['customer_ip_service_type'] = $ipInfo['service_type'];

                $locked->update(['meta' => $meta]);
            });
        }

        // A webhook that read the order before this write can still save its older copy over it (the lookup
        // can also fail): check again shortly and fill the fields in if they are gone.
        if ($this->attempt < self::MAX_ATTEMPTS) {
            self::dispatch($this->orderId, $this->ip, $this->attempt + 1)->delay(now()->addSeconds(30));
        }
    }
}
