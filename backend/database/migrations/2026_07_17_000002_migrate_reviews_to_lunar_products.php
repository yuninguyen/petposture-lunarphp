<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $lunarProductsTable = config('lunar.database.table_prefix', 'lunar_').'products';
        $report = $this->upReport($lunarProductsTable);

        if ($report['unmapped'] > 0) {
            throw new RuntimeException(sprintf(
                'Review migration preflight failed: reviews=%d, mappable=%d, unmapped=%d. No schema changes were applied. Create complete product_sync_mappings rows before retrying.',
                $report['reviews'],
                $report['mappable'],
                $report['unmapped'],
            ));
        }

        Schema::table('reviews', function (Blueprint $table) use ($lunarProductsTable) {
            $table->foreignId('lunar_product_id')->nullable()->after('id')->constrained($lunarProductsTable)->cascadeOnDelete();
        });

        DB::table('reviews')
            ->orderBy('id')
            ->each(function (object $review): void {
                $lunarProductId = DB::table('product_sync_mappings')
                    ->where('legacy_product_id', $review->product_id)
                    ->value('lunar_product_id');

                DB::table('reviews')->where('id', $review->id)->update([
                    'lunar_product_id' => $lunarProductId,
                ]);
            });

        $remaining = DB::table('reviews')->whereNull('lunar_product_id')->count();
        if ($remaining > 0) {
            throw new RuntimeException(sprintf(
                'Review migration reconciliation failed after backfill: reviews=%d, mappable=%d, unmapped=%d. The legacy product_id column was preserved.',
                $report['reviews'],
                $report['reviews'] - $remaining,
                $remaining,
            ));
        }

        Schema::table('reviews', function (Blueprint $table) {
            $table->dropForeign(['product_id']);
            $table->dropColumn('product_id');
        });
    }

    public function down(): void
    {
        $report = $this->downReport();

        if ($report['unmapped'] > 0) {
            throw new RuntimeException(sprintf(
                'Review migration rollback preflight failed: reviews=%d, mappable=%d, unmapped=%d. The Lunar review schema was preserved.',
                $report['reviews'],
                $report['mappable'],
                $report['unmapped'],
            ));
        }

        Schema::table('reviews', function (Blueprint $table) {
            $table->foreignId('product_id')->nullable()->after('id')->constrained()->cascadeOnDelete();
        });

        DB::table('reviews')
            ->orderBy('id')
            ->each(function (object $review): void {
                $legacyProductId = DB::table('product_sync_mappings')
                    ->where('lunar_product_id', $review->lunar_product_id)
                    ->value('legacy_product_id');

                DB::table('reviews')->where('id', $review->id)->update([
                    'product_id' => $legacyProductId,
                ]);
            });

        $remaining = DB::table('reviews')->whereNull('product_id')->count();
        if ($remaining > 0) {
            throw new RuntimeException(sprintf(
                'Review migration rollback reconciliation failed: reviews=%d, mappable=%d, unmapped=%d. The lunar_product_id column was preserved.',
                $report['reviews'],
                $report['reviews'] - $remaining,
                $remaining,
            ));
        }

        Schema::table('reviews', function (Blueprint $table) {
            $table->dropForeign(['lunar_product_id']);
            $table->dropColumn('lunar_product_id');
        });
    }

    /** @return array{reviews: int, mappable: int, unmapped: int} */
    private function upReport(string $lunarProductsTable): array
    {
        $reviews = DB::table('reviews')->count();
        $mappable = DB::table('reviews')
            ->join('product_sync_mappings', 'product_sync_mappings.legacy_product_id', '=', 'reviews.product_id')
            ->join($lunarProductsTable, $lunarProductsTable.'.id', '=', 'product_sync_mappings.lunar_product_id')
            ->distinct()
            ->count('reviews.id');

        return [
            'reviews' => $reviews,
            'mappable' => $mappable,
            'unmapped' => $reviews - $mappable,
        ];
    }

    /** @return array{reviews: int, mappable: int, unmapped: int} */
    private function downReport(): array
    {
        $reviews = DB::table('reviews')->count();
        $mappable = DB::table('reviews')
            ->join('product_sync_mappings', 'product_sync_mappings.lunar_product_id', '=', 'reviews.lunar_product_id')
            ->join('products', 'products.id', '=', 'product_sync_mappings.legacy_product_id')
            ->distinct()
            ->count('reviews.id');

        return [
            'reviews' => $reviews,
            'mappable' => $mappable,
            'unmapped' => $reviews - $mappable,
        ];
    }
};
