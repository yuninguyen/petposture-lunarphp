<?php

namespace App\Jobs;

use App\Models\AffiliateNetwork;
use App\Services\Affiliate\AffiliateNetworkSyncService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Log;

class SyncAffiliateReportJob implements ShouldQueue
{
    use Dispatchable;
    use InteractsWithQueue;
    use Queueable;
    use SerializesModels;

    public int $tries = 3;

    /** @var array<int> */
    public array $backoff = [60, 300, 900];

    public function __construct(
        public readonly ?int $affiliateNetworkId = null,
        public readonly ?string $date = null,
    ) {}

    public function handle(AffiliateNetworkSyncService $syncService): void
    {
        $date = $this->date ? Carbon::parse($this->date) : now()->subDay();

        $networks = AffiliateNetwork::query()
            ->where('active', true)
            ->whereNotNull('provider')
            ->when($this->affiliateNetworkId, fn ($query) => $query->where('id', $this->affiliateNetworkId))
            ->get();

        foreach ($networks as $network) {
            try {
                $syncService->sync($network, $date);
            } catch (\Throwable $e) {
                Log::warning("Affiliate report sync failed for network [{$network->slug}]: {$e->getMessage()}");
            }
        }
    }
}
