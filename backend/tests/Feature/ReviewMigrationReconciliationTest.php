<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\Legacy\Product as LegacyProduct;
use App\Models\ProductSyncMapping;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Lunar\Models\Product as LunarProduct;
use Tests\TestCase;

class ReviewMigrationReconciliationTest extends TestCase
{
    use RefreshDatabase;

    public function test_existing_reviews_are_fully_mapped_before_legacy_column_is_dropped(): void
    {
        $migration = $this->reviewMigration();
        $migration->down();

        [$legacy, $lunar] = $this->createMappedProducts();
        $reviewId = $this->insertLegacyReview($legacy->id);

        $migration->up();

        $this->assertFalse(Schema::hasColumn('reviews', 'product_id'));
        $this->assertDatabaseHas('reviews', [
            'id' => $reviewId,
            'lunar_product_id' => $lunar->id,
        ]);
    }

    public function test_migration_fails_with_counts_and_preserves_legacy_column_when_any_review_is_unmapped(): void
    {
        $migration = $this->reviewMigration();
        $migration->down();

        $legacy = $this->createLegacyProduct('orphaned-review-product');
        $this->insertLegacyReview($legacy->id);

        $exception = null;
        try {
            $migration->up();
        } catch (\RuntimeException $caught) {
            $exception = $caught;
        }

        $this->assertNotNull($exception, 'Expected review reconciliation to fail.');
        $this->assertStringContainsString('reviews=1', $exception->getMessage());
        $this->assertStringContainsString('mappable=0', $exception->getMessage());
        $this->assertStringContainsString('unmapped=1', $exception->getMessage());
        $this->assertTrue(Schema::hasColumn('reviews', 'product_id'));
        $this->assertFalse(Schema::hasColumn('reviews', 'lunar_product_id'));
    }

    public function test_rollback_reconciles_lunar_reviews_back_to_legacy_products(): void
    {
        [$legacy, $lunar] = $this->createMappedProducts();
        $reviewId = (int) DB::table('reviews')->insertGetId([
            'lunar_product_id' => $lunar->id,
            'customer_name' => 'Rollback Reviewer',
            'customer_email' => 'rollback@example.com',
            'rating' => 4,
            'comment' => 'Rollback evidence.',
            'is_verified' => false,
            'status' => 'approved',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->reviewMigration()->down();

        $this->assertFalse(Schema::hasColumn('reviews', 'lunar_product_id'));
        $this->assertDatabaseHas('reviews', [
            'id' => $reviewId,
            'product_id' => $legacy->id,
        ]);
    }

    private function reviewMigration(): object
    {
        return require database_path('migrations/2026_07_17_000002_migrate_reviews_to_lunar_products.php');
    }

    /** @return array{LegacyProduct, LunarProduct} */
    private function createMappedProducts(): array
    {
        $legacy = $this->createLegacyProduct('mapped-review-product');
        $lunar = LunarProduct::factory()->create();

        ProductSyncMapping::query()->create([
            'legacy_product_id' => $legacy->id,
            'lunar_product_id' => $lunar->id,
            'legacy_slug' => $legacy->slug,
            'synced_at' => now(),
        ]);

        return [$legacy, $lunar];
    }

    private function createLegacyProduct(string $slug): LegacyProduct
    {
        $category = Category::query()->create([
            'name' => 'Review Migration',
            'slug' => 'review-migration-'.$slug,
            'type' => 'product',
        ]);

        return LegacyProduct::query()->create([
            'category_id' => $category->id,
            'name' => 'Legacy Review Product',
            'slug' => $slug,
            'price' => 49.99,
            'stock_quantity' => 1,
            'is_active' => true,
        ]);
    }

    private function insertLegacyReview(int $productId): int
    {
        return (int) DB::table('reviews')->insertGetId([
            'product_id' => $productId,
            'customer_name' => 'Legacy Reviewer',
            'customer_email' => 'legacy@example.com',
            'rating' => 5,
            'comment' => 'Existing review.',
            'is_verified' => false,
            'status' => 'approved',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }
}
