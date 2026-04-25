<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\Product as LegacyProduct;
use App\Models\ProductSyncMapping;
use App\Services\ProductSyncService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Lunar\Models\Channel;
use Lunar\Models\Country;
use Lunar\Models\Currency;
use Lunar\Models\CustomerGroup;
use Lunar\Models\Language;
use Lunar\Models\Product as LunarProduct;
use Lunar\Models\ProductType;
use Lunar\Models\TaxClass;
use Lunar\Models\TaxRate;
use Lunar\Models\TaxRateAmount;
use Lunar\Models\TaxZone;
use Lunar\Models\Url;
use Tests\TestCase;

class ProductCatalogApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_sync_from_legacy_reuses_the_same_lunar_product_when_slug_changes(): void
    {
        $this->setUpLunarPrerequisites();
        $category = Category::create([
            'name' => 'Dog Beds',
            'slug' => 'dog-beds',
            'type' => 'product',
        ]);

        $legacyProduct = LegacyProduct::create([
            'category_id' => $category->id,
            'name' => 'Orthopedic Bed',
            'slug' => 'orthopedic-bed',
            'price' => 89.99,
            'stock_quantity' => 8,
            'description' => 'Supportive bed for dogs.',
            'is_active' => true,
        ]);

        $service = app(ProductSyncService::class);

        $initialLunarProduct = $service->syncFromLegacy($legacyProduct);

        $legacyProduct->update([
            'slug' => 'orthopedic-bed-v2',
            'price' => 94.99,
        ]);

        $resyncedLunarProduct = $service->syncFromLegacy($legacyProduct);

        $this->assertNotNull($initialLunarProduct);
        $this->assertSame($initialLunarProduct->id, $resyncedLunarProduct?->id);
        $this->assertDatabaseHas('product_sync_mappings', [
            'legacy_product_id' => $legacyProduct->id,
            'lunar_product_id' => $initialLunarProduct->id,
            'legacy_slug' => 'orthopedic-bed-v2',
        ]);

        $mapping = ProductSyncMapping::query()->with('lunarProduct.variants')->first();
        $syncedLunarProduct = $mapping?->lunarProduct?->fresh(['variants']);

        $this->assertNotNull($mapping);
        $this->assertNotNull($syncedLunarProduct);
        $this->assertCount(1, $syncedLunarProduct->variants);
        $this->assertSame('legacy-product-'.$legacyProduct->id.'-default', $syncedLunarProduct->variants->first()->sku);
        $this->assertSame(
            'orthopedic-bed-v2',
            Url::query()
                ->where('element_type', LunarProduct::class)
                ->where('element_id', $syncedLunarProduct->id)
                ->where('default', true)
                ->value('slug')
        );
    }

    public function test_product_index_only_returns_published_synced_products(): void
    {
        $this->setUpLunarPrerequisites();
        $category = Category::create([
            'name' => 'Dog Beds',
            'slug' => 'dog-beds',
            'type' => 'product',
        ]);

        $service = app(ProductSyncService::class);

        $published = LegacyProduct::create([
            'category_id' => $category->id,
            'name' => 'Published Bed',
            'slug' => 'published-bed',
            'price' => 99.99,
            'old_price' => 129.99,
            'stock_quantity' => 5,
            'description' => 'Visible in storefront.',
            'badge' => 'SALE',
            'is_new' => true,
            'rating' => 4.7,
            'reviews_count' => 12,
            'is_active' => true,
        ]);

        $draft = LegacyProduct::create([
            'category_id' => $category->id,
            'name' => 'Hidden Bed',
            'slug' => 'hidden-bed',
            'price' => 79.99,
            'stock_quantity' => 3,
            'description' => 'Should not appear.',
            'is_active' => false,
        ]);

        $service->syncFromLegacy($published);
        $service->syncFromLegacy($draft);

        $response = $this->getJson('/api/products');

        $response->assertOk()
            ->assertJsonPath('data.0.slug', 'published-bed')
            ->assertJsonPath('data.0.price', 99.99)
            ->assertJsonPath('data.0.oldPrice', 129.99)
            ->assertJsonPath('data.0.badge', 'SALE')
            ->assertJsonPath('data.0.isNew', true)
            ->assertJsonPath('data.0.rating', 4.7)
            ->assertJsonPath('data.0.reviews', 12);

        $this->assertCount(1, $response->json('data'));
    }

    public function test_deleting_legacy_product_archives_the_synced_lunar_product(): void
    {
        $this->setUpLunarPrerequisites();
        $category = Category::create([
            'name' => 'Dog Beds',
            'slug' => 'dog-beds',
            'type' => 'product',
        ]);

        $legacyProduct = LegacyProduct::create([
            'category_id' => $category->id,
            'name' => 'Archive Me',
            'slug' => 'archive-me',
            'price' => 89.99,
            'stock_quantity' => 4,
            'description' => 'Archive synced Lunar product on delete.',
            'is_active' => true,
        ]);

        $lunarProduct = app(ProductSyncService::class)->syncFromLegacy($legacyProduct);

        $this->assertNotNull($lunarProduct);
        $this->assertSame('published', $lunarProduct->status);

        $legacyProduct->delete();

        $this->assertDatabaseMissing('product_sync_mappings', [
            'legacy_product_id' => $legacyProduct->id,
        ]);
        $this->assertSame('draft', LunarProduct::query()->find($lunarProduct->id)?->status);
    }

    private function setUpLunarPrerequisites(): void
    {
        $language = Language::firstOrCreate(
            ['code' => 'en'],
            ['name' => 'English', 'default' => true]
        );
        if (! $language->default) {
            $language->forceFill(['default' => true])->save();
        }

        $currency = Currency::firstOrCreate(
            ['code' => 'USD'],
            [
                'name' => 'US Dollar',
                'decimal_places' => 2,
                'default' => true,
                'enabled' => true,
                'exchange_rate' => 1,
            ]
        );
        if (! $currency->default || ! $currency->enabled) {
            $currency->forceFill(['default' => true, 'enabled' => true])->save();
        }

        $channel = Channel::firstOrCreate(
            ['handle' => 'webstore'],
            [
                'name' => 'Webstore',
                'default' => true,
                'url' => 'http://localhost',
            ]
        );
        if (! $channel->default) {
            $channel->forceFill(['default' => true])->save();
        }

        $customerGroup = CustomerGroup::firstOrCreate(
            ['handle' => 'retail'],
            [
                'name' => 'Retail',
                'default' => true,
            ]
        );
        if (! $customerGroup->default) {
            $customerGroup->forceFill(['default' => true])->save();
        }

        $country = Country::firstOrCreate(
            ['iso2' => 'US'],
            [
                'name' => 'United States',
                'iso3' => 'USA',
                'phonecode' => '1',
                'capital' => 'Washington',
                'currency' => 'USD',
                'native' => 'United States',
                'emoji' => 'US',
                'emoji_u' => 'U+1F1FA U+1F1F8',
            ]
        );

        $taxClass = TaxClass::firstOrCreate(
            ['name' => 'Default'],
            ['default' => true]
        );
        if (! $taxClass->default) {
            $taxClass->forceFill(['default' => true])->save();
        }

        $taxZone = TaxZone::firstOrCreate(
            ['name' => 'Default Tax Zone'],
            [
                'zone_type' => 'country',
                'price_display' => 'tax_exclusive',
                'active' => true,
                'default' => true,
            ]
        );
        if (! $taxZone->default || ! $taxZone->active) {
            $taxZone->forceFill(['default' => true, 'active' => true])->save();
        }

        if (! $taxZone->countries()->where('country_id', $country->id)->exists()) {
            $taxZone->countries()->create([
                'country_id' => $country->id,
            ]);
        }

        $taxRate = TaxRate::firstOrCreate(
            ['name' => 'Default Tax Rate'],
            [
                'tax_zone_id' => $taxZone->id,
                'priority' => 1,
            ]
        );

        TaxRateAmount::firstOrCreate(
            [
                'tax_rate_id' => $taxRate->id,
                'tax_class_id' => $taxClass->id,
            ],
            [
                'percentage' => 0,
            ]
        );

        ProductType::firstOrCreate(['name' => 'General']);
    }
}
