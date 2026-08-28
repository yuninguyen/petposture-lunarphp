<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\Legacy\Product as LegacyProduct;
use App\Models\ProductSyncMapping;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Lunar\Models\Product as LunarProduct;
use Tests\TestCase;

class LegacyProductMigrationAuditCommandTest extends TestCase
{
    use RefreshDatabase;

    public function test_audit_fails_read_only_when_legacy_product_is_not_mapped_to_lunar(): void
    {
        $legacy = $this->legacyProduct('unmapped-product');

        $this->artisan('products:audit-legacy-migration')
            ->expectsOutputToContain('"unmapped_count": 1')
            ->assertFailed();

        $this->assertDatabaseHas('products', ['id' => $legacy->id, 'slug' => 'unmapped-product']);
        $this->assertDatabaseCount('product_sync_mappings', 0);
    }

    public function test_audit_succeeds_when_every_legacy_product_has_a_live_lunar_mapping(): void
    {
        $legacy = $this->legacyProduct('mapped-product');
        $lunar = LunarProduct::factory()->create();
        ProductSyncMapping::query()->create([
            'legacy_product_id' => $legacy->id,
            'lunar_product_id' => $lunar->id,
            'legacy_slug' => $legacy->slug,
            'synced_at' => now(),
        ]);

        $this->artisan('products:audit-legacy-migration')
            ->expectsOutputToContain('"unmapped_count": 0')
            ->assertSuccessful();
    }

    private function legacyProduct(string $slug): LegacyProduct
    {
        $category = Category::query()->create([
            'name' => 'Legacy category',
            'slug' => 'legacy-category-'.$slug,
            'type' => 'product',
        ]);

        return LegacyProduct::query()->create([
            'category_id' => $category->id,
            'name' => 'Legacy product',
            'slug' => $slug,
            'price' => 10,
            'stock_quantity' => 1,
            'is_active' => true,
        ]);
    }
}
