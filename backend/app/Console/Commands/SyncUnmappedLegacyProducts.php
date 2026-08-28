<?php

namespace App\Console\Commands;

use App\Models\Legacy\Product as LegacyProduct;
use App\Models\ProductSyncMapping;
use App\Services\ProductSyncService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Lunar\Models\Product as LunarProduct;
use Throwable;

class SyncUnmappedLegacyProducts extends Command
{
    protected $signature = 'products:sync-unmapped-legacy
        {--execute : Perform the one-time migration; without this flag the command is read-only}';

    protected $description = 'Dry-run or migrate legacy products that do not map to a live Lunar product';

    public function handle(ProductSyncService $syncService): int
    {
        $lunarTable = (new LunarProduct)->getTable();
        if (! Schema::hasTable('products')
            || ! Schema::hasTable('product_sync_mappings')
            || ! Schema::hasTable($lunarTable)) {
            $this->error('Required legacy migration tables are unavailable.');

            return self::FAILURE;
        }

        $candidateIds = $this->candidateIds($lunarTable);
        $candidates = LegacyProduct::query()
            ->whereKey($candidateIds)
            ->orderBy('id')
            ->get();
        $execute = (bool) $this->option('execute');

        if (! $execute) {
            $this->line(json_encode([
                'dry_run' => true,
                'candidate_count' => $candidates->count(),
                'candidates' => $candidates->map->only(['id', 'slug', 'name', 'updated_at'])->all(),
            ], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));

            return $candidates->isEmpty() ? self::SUCCESS : self::FAILURE;
        }

        $synced = [];
        $failed = [];

        foreach ($candidates as $legacyProduct) {
            try {
                $lunarProduct = $syncService->syncFromLegacy($legacyProduct);
                $hasLiveMapping = $lunarProduct && ProductSyncMapping::query()
                    ->where('legacy_product_id', $legacyProduct->id)
                    ->where('lunar_product_id', $lunarProduct->id)
                    ->exists();

                if (! $hasLiveMapping) {
                    throw new \RuntimeException('syncFromLegacy did not produce a live ProductSyncMapping.');
                }

                $synced[] = [
                    'legacy_product_id' => $legacyProduct->id,
                    'legacy_slug' => $legacyProduct->slug,
                    'lunar_product_id' => $lunarProduct->id,
                ];
            } catch (Throwable $exception) {
                $failed[] = [
                    'legacy_product_id' => $legacyProduct->id,
                    'legacy_slug' => $legacyProduct->slug,
                    'error' => mb_substr($exception->getMessage(), 0, 1000),
                ];
            }
        }

        $this->line(json_encode([
            'dry_run' => false,
            'candidate_count' => $candidates->count(),
            'synced_count' => count($synced),
            'failed_count' => count($failed),
            'synced' => $synced,
            'failed' => $failed,
        ], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));

        return $failed === [] ? self::SUCCESS : self::FAILURE;
    }

    /** @return array<int, int> */
    private function candidateIds(string $lunarTable): array
    {
        return DB::table('products as legacy')
            ->leftJoin('product_sync_mappings as mapping', 'mapping.legacy_product_id', '=', 'legacy.id')
            ->leftJoin("{$lunarTable} as lunar", 'lunar.id', '=', 'mapping.lunar_product_id')
            ->where(function ($query) {
                $query->whereNull('mapping.id')->orWhereNull('lunar.id');
            })
            ->orderBy('legacy.id')
            ->pluck('legacy.id')
            ->map(fn ($id) => (int) $id)
            ->all();
    }
}
