<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\Legacy\Product as LegacyProduct;
use App\Models\ProductSyncMapping;
use App\Services\ProductSyncService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;
use Lunar\Models\Product as LunarProduct;
use Mockery;
use Tests\TestCase;

class LegacyProductSyncCommandTest extends TestCase
{
    use RefreshDatabase;

    public function test_command_is_dry_run_by_default_and_does_not_sync(): void
    {
        $legacy = $this->legacyProduct('dry-run-product');
        $this->mock(ProductSyncService::class, function ($mock) {
            $mock->shouldNotReceive('syncFromLegacy');
        });

        $exitCode = Artisan::call('products:sync-unmapped-legacy');
        $output = Artisan::output();

        $this->assertSame(1, $exitCode);
        $this->assertStringContainsString('"dry_run": true', $output);
        $this->assertStringContainsString('"candidate_count": 1', $output, $output);
        $this->assertDatabaseHas('products', ['id' => $legacy->id]);
        $this->assertDatabaseCount('product_sync_mappings', 0);
    }

    public function test_execute_syncs_each_candidate_and_preserves_legacy_row(): void
    {
        $legacy = $this->legacyProduct('sync-product');
        $lunar = LunarProduct::factory()->create();
        $this->mock(ProductSyncService::class, function ($mock) use ($legacy, $lunar) {
            $mock->shouldReceive('syncFromLegacy')
                ->once()
                ->with(Mockery::on(fn (LegacyProduct $product) => $product->is($legacy)))
                ->andReturnUsing(function () use ($legacy, $lunar) {
                    ProductSyncMapping::query()->create([
                        'legacy_product_id' => $legacy->id,
                        'lunar_product_id' => $lunar->id,
                        'legacy_slug' => $legacy->slug,
                        'synced_at' => now(),
                    ]);

                    return $lunar;
                });
        });

        $exitCode = Artisan::call('products:sync-unmapped-legacy', ['--execute' => true]);
        $output = Artisan::output();

        $this->assertSame(0, $exitCode);
        $this->assertStringContainsString('"synced_count": 1', $output);
        $this->assertStringContainsString('"failed_count": 0', $output);
        $this->assertDatabaseHas('products', ['id' => $legacy->id]);
        $this->assertDatabaseHas('product_sync_mappings', [
            'legacy_product_id' => $legacy->id,
            'lunar_product_id' => $lunar->id,
        ]);
    }

    public function test_execute_fails_loudly_when_sync_service_cannot_migrate_candidate(): void
    {
        $legacy = $this->legacyProduct('failed-product');
        $this->mock(ProductSyncService::class, function ($mock) {
            $mock->shouldReceive('syncFromLegacy')->once()->andReturnNull();
        });

        $exitCode = Artisan::call('products:sync-unmapped-legacy', ['--execute' => true]);
        $output = Artisan::output();

        $this->assertSame(1, $exitCode);
        $this->assertStringContainsString('"failed_count": 1', $output);
        $this->assertStringContainsString('"legacy_product_id": '.$legacy->id, $output);
        $this->assertDatabaseHas('products', ['id' => $legacy->id]);
        $this->assertDatabaseCount('product_sync_mappings', 0);
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
