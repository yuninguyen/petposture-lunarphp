<?php

namespace App\Console\Commands;

use App\Models\Legacy\Product as LegacyProduct;
use App\Models\ProductSyncMapping;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Lunar\Models\Product as LunarProduct;

class AuditLegacyProductMigration extends Command
{
    protected $signature = 'products:audit-legacy-migration';

    protected $description = 'Read-only audit of legacy products that are not mapped to a live Lunar product';

    public function handle(): int
    {
        $lunarTable = (new LunarProduct)->getTable();

        if (! Schema::hasTable('products')
            || ! Schema::hasTable('product_sync_mappings')
            || ! Schema::hasTable($lunarTable)) {
            $this->error(json_encode([
                'legacy_products_table' => Schema::hasTable('products'),
                'product_sync_mappings_table' => Schema::hasTable('product_sync_mappings'),
                'lunar_products_table' => Schema::hasTable($lunarTable),
                'error' => 'Required legacy migration tables are unavailable.',
            ], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));

            return self::FAILURE;
        }

        $legacyTable = (new LegacyProduct)->getTable();
        $mappingTable = (new ProductSyncMapping)->getTable();
        $migrationState = DB::table("{$legacyTable} as legacy")
            ->leftJoin("{$mappingTable} as mapping", 'mapping.legacy_product_id', '=', 'legacy.id')
            ->leftJoin("{$lunarTable} as lunar", 'lunar.id', '=', 'mapping.lunar_product_id');
        $unmappedQuery = (clone $migrationState)->where(function ($query) {
            $query->whereNull('mapping.id')->orWhereNull('lunar.id');
        });
        $unmapped = (clone $unmappedQuery)
            ->orderBy('legacy.id')
            ->get(['legacy.id', 'legacy.slug', 'legacy.name', 'legacy.updated_at']);
        $brokenMappingCount = DB::table("{$mappingTable} as mapping")
            ->leftJoin("{$legacyTable} as legacy", 'legacy.id', '=', 'mapping.legacy_product_id')
            ->leftJoin("{$lunarTable} as lunar", 'lunar.id', '=', 'mapping.lunar_product_id')
            ->where(function ($query) {
                $query->whereNull('legacy.id')->orWhereNull('lunar.id');
            })
            ->count();

        $result = [
            'environment' => app()->environment(),
            'connection' => config('database.default'),
            'legacy_total' => DB::table($legacyTable)->count(),
            'validly_mapped' => (clone $migrationState)
                ->whereNotNull('mapping.id')
                ->whereNotNull('lunar.id')
                ->count(),
            'unmapped_count' => $unmapped->count(),
            'broken_mapping_count' => $brokenMappingCount,
            'unmapped' => $unmapped->map(fn ($row) => (array) $row)->all(),
        ];

        $this->line(json_encode($result, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));

        return $unmapped->isEmpty() && $brokenMappingCount === 0
            ? self::SUCCESS
            : self::FAILURE;
    }
}
