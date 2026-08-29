<?php

namespace Tests\Feature;

use App\Models\Breed;
use App\Models\Category;
use App\Models\Legacy\Product as LegacyProduct;
use App\Models\ProductSyncMapping;
use App\Models\Review;
use App\Models\Solution;
use App\Services\ProductSyncService;
use Illuminate\Database\Events\QueryExecuted;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
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
            ->assertJsonPath('data.0.rating', 0)
            ->assertJsonPath('data.0.reviews', 0)
            ->assertJsonPath('data.0.reviewCount', 0);

        $this->assertCount(1, $response->json('data'));
    }

    public function test_product_rating_aggregate_uses_only_approved_reviews(): void
    {
        $this->setUpLunarPrerequisites();
        $product = $this->syncLegacyProduct(
            Category::query()->create(['name' => 'Review products', 'slug' => 'review-products', 'type' => 'product']),
            'Reviewed bed',
            'reviewed-bed'
        );

        Review::query()->create(['lunar_product_id' => $product->id, 'customer_name' => 'Approved one', 'customer_email' => 'one@example.com', 'rating' => 5, 'comment' => 'Great', 'status' => 'approved']);
        Review::query()->create(['lunar_product_id' => $product->id, 'customer_name' => 'Approved two', 'customer_email' => 'two@example.com', 'rating' => 4, 'comment' => 'Good', 'status' => 'approved']);
        Review::query()->create(['lunar_product_id' => $product->id, 'customer_name' => 'Pending', 'customer_email' => 'pending@example.com', 'rating' => 1, 'comment' => 'Pending', 'status' => 'pending']);

        $response = $this->getJson('/api/products')->assertOk();

        $response->assertJsonPath('data.0.rating', 4.5)
            ->assertJsonPath('data.0.reviews', 2)
            ->assertJsonPath('data.0.reviewCount', 2)
            ->assertJsonPath('data.0.seo.aggregateRating.ratingValue', 4.5)
            ->assertJsonPath('data.0.seo.aggregateRating.reviewCount', 2)
            ->assertJsonPath('data.0.seo.url', url('/shop/categories/reviewed-bed'))
            ->assertJsonPath('data.0.seo.offers.url', url('/shop/categories/reviewed-bed'));
    }

    public function test_product_index_uses_one_set_based_review_aggregate_query_for_multiple_products(): void
    {
        $this->setUpLunarPrerequisites();
        $category = Category::query()->create(['name' => 'Aggregate products', 'slug' => 'aggregate-products', 'type' => 'product']);
        $first = $this->syncLegacyProduct($category, 'First aggregate bed', 'first-aggregate-bed');
        $second = $this->syncLegacyProduct($category, 'Second aggregate bed', 'second-aggregate-bed');

        Review::query()->create(['lunar_product_id' => $first->id, 'customer_name' => 'First reviewer', 'customer_email' => 'first@example.com', 'rating' => 5, 'comment' => 'Excellent', 'status' => 'approved']);
        Review::query()->create(['lunar_product_id' => $first->id, 'customer_name' => 'Second reviewer', 'customer_email' => 'second@example.com', 'rating' => 3, 'comment' => 'Good', 'status' => 'approved']);
        Review::query()->create(['lunar_product_id' => $second->id, 'customer_name' => 'Third reviewer', 'customer_email' => 'third@example.com', 'rating' => 2, 'comment' => 'Okay', 'status' => 'approved']);

        $queries = [];
        DB::listen(function (QueryExecuted $query) use (&$queries): void {
            $queries[] = strtolower($query->sql);
        });

        $data = collect($this->getJson('/api/products?per_page=100')->assertOk()->json('data'))
            ->keyBy('slug');

        $this->assertEquals(4.0, $data->get('first-aggregate-bed')['rating']);
        $this->assertSame(2, $data->get('first-aggregate-bed')['reviewCount']);
        $this->assertEquals(2.0, $data->get('second-aggregate-bed')['rating']);
        $this->assertSame(1, $data->get('second-aggregate-bed')['reviewCount']);
        $this->assertCount(1, collect($queries)->filter(fn (string $sql): bool => str_contains($sql, 'reviews')));
    }

    public function test_product_without_approved_reviews_has_no_aggregate_rating_in_json_ld(): void
    {
        $this->setUpLunarPrerequisites();
        $product = $this->syncLegacyProduct(
            Category::query()->create(['name' => 'Unreviewed products', 'slug' => 'unreviewed-products', 'type' => 'product']),
            'Unreviewed bed',
            'unreviewed-bed'
        );
        Review::query()->create(['lunar_product_id' => $product->id, 'customer_name' => 'Pending', 'customer_email' => 'pending-only@example.com', 'rating' => 5, 'comment' => 'Pending', 'status' => 'pending']);

        $this->getJson('/api/products/'.$product->id)->assertOk()->assertJsonMissingPath('data.seo.aggregateRating');
    }

    public function test_product_rating_attributes_cannot_fabricate_review_aggregates(): void
    {
        $this->setUpLunarPrerequisites();
        $product = $this->syncLegacyProduct(
            Category::query()->create(['name' => 'Fabricated products', 'slug' => 'fabricated-products', 'type' => 'product']),
            'Fabricated bed',
            'fabricated-bed'
        );
        DB::table('lunar_products')->where('id', $product->id)->update([
            'attribute_data' => json_encode([
                'rating' => ['field_type' => 'text', 'value' => '5'],
                'reviews' => ['field_type' => 'text', 'value' => '999'],
            ]),
        ]);

        $response = $this->getJson('/api/products/'.$product->id)->assertOk();

        $response->assertJsonPath('data.rating', 0)
            ->assertJsonPath('data.reviews', 0)
            ->assertJsonMissingPath('data.seo.aggregateRating');
    }

    public function test_every_public_product_payload_traces_to_lunar_and_ignores_legacy_only_rows(): void
    {
        $this->setUpLunarPrerequisites();
        $category = Category::query()->create([
            'name' => 'Invariant products',
            'slug' => 'invariant-products',
            'type' => 'product',
        ]);
        $source = LegacyProduct::query()->create([
            'category_id' => $category->id,
            'name' => 'Lunar-backed product',
            'slug' => 'lunar-backed-product',
            'price' => 49.99,
            'stock_quantity' => 5,
            'is_active' => true,
        ]);
        $lunarProduct = app(ProductSyncService::class)->syncFromLegacy($source);
        $this->assertNotNull($lunarProduct);

        $legacyOnly = new LegacyProduct([
            'category_id' => $category->id,
            'name' => 'Legacy-only product',
            'slug' => 'legacy-only-product',
            'price' => 19.99,
            'stock_quantity' => 5,
            'is_active' => true,
        ]);
        $legacyOnly->saveQuietly();

        $response = $this->getJson('/api/products')->assertOk();
        $productIds = collect($response->json('data'))->pluck('id')->map(fn ($id) => (int) $id);

        $this->assertNotEmpty($productIds);
        $this->assertSame(
            $productIds->count(),
            LunarProduct::query()->whereKey($productIds)->count(),
            'Every public product must reference lunar_products.id.'
        );
        $response->assertJsonMissing(['slug' => 'legacy-only-product']);

        $this->getJson("/api/products/{$lunarProduct->id}")
            ->assertOk()
            ->assertJsonPath('data.id', $lunarProduct->id);
        $this->getJson('/api/products/legacy-only-product')->assertNotFound();
    }

    public function test_product_filters_use_normalized_breed_and_solution_pivots(): void
    {
        $this->setUpLunarPrerequisites();
        $category = Category::query()->create([
            'name' => 'Filter products',
            'slug' => 'filter-products',
            'type' => 'product',
        ]);
        $breedProduct = $this->syncLegacyProduct($category, 'Breed match', 'breed-match');
        $solutionProduct = $this->syncLegacyProduct($category, 'Solution match', 'solution-match');
        $unrelatedProduct = $this->syncLegacyProduct($category, 'Unrelated', 'unrelated');
        $breed = Breed::query()->create([
            'name' => 'Flat faced',
            'slug' => 'flat-faced',
            'body_type' => 'brachycephalic',
        ]);
        $solution = Solution::query()->create([
            'name' => 'Mobility support',
            'slug' => 'mobility-support',
        ]);
        $breed->products()->attach($breedProduct->id);
        $solution->products()->attach($solutionProduct->id);

        $breedIds = collect($this->getJson('/api/products?breed=flat-faced')->assertOk()->json('data'))->pluck('id');
        $solutionIds = collect($this->getJson('/api/products?solution=mobility-support')->assertOk()->json('data'))->pluck('id');

        $this->assertSame([$breedProduct->id], $breedIds->all());
        $this->assertSame([$solutionProduct->id], $solutionIds->all());
        $this->assertNotContains($unrelatedProduct->id, $breedIds);
        $this->assertNotContains($unrelatedProduct->id, $solutionIds);
    }

    public function test_badge_filter_uses_an_exact_normalized_index_value(): void
    {
        $this->setUpLunarPrerequisites();
        $category = Category::query()->create([
            'name' => 'Badge products',
            'slug' => 'badge-products',
            'type' => 'product',
        ]);
        $bestSeller = $this->syncLegacyProduct($category, 'Best seller', 'best-seller', 'Best Seller');
        $notBestSeller = $this->syncLegacyProduct($category, 'Not best seller', 'not-best-seller', 'Not Best Seller');

        $this->assertSame('best-seller', $bestSeller->fresh()?->badge_slug);
        $this->assertSame('not-best-seller', $notBestSeller->fresh()?->badge_slug);

        $ids = collect($this->getJson('/api/products?badge=Best%20Seller')->assertOk()->json('data'))->pluck('id');

        $this->assertSame([$bestSeller->id], $ids->all());
    }

    public function test_related_products_use_stable_ordering_without_database_randomization(): void
    {
        $this->setUpLunarPrerequisites();
        $category = Category::query()->create([
            'name' => 'Related products',
            'slug' => 'related-products',
            'type' => 'product',
        ]);
        $products = collect(range(1, 6))->map(fn (int $number) => $this->syncLegacyProduct(
            $category,
            "Related {$number}",
            "related-{$number}"
        ));
        $queries = [];
        DB::listen(function (QueryExecuted $query) use (&$queries): void {
            $queries[] = strtolower($query->sql);
        });

        $first = collect($this->getJson('/api/products/'.$products->first()->id.'/related')->assertOk()->json('data'))
            ->pluck('id')->all();
        $second = collect($this->getJson('/api/products/'.$products->first()->id.'/related')->assertOk()->json('data'))
            ->pluck('id')->all();

        $this->assertSame($first, $second);
        $this->assertSame(collect($first)->sort()->values()->all(), $first);
        $this->assertFalse(collect($queries)->contains(fn (string $sql) => str_contains($sql, 'random(')));
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

    private function syncLegacyProduct(
        Category $category,
        string $name,
        string $slug,
        ?string $badge = null
    ): LunarProduct {
        $legacyProduct = LegacyProduct::query()->create([
            'category_id' => $category->id,
            'name' => $name,
            'slug' => $slug,
            'price' => 25,
            'stock_quantity' => 5,
            'badge' => $badge,
            'is_active' => true,
        ]);
        $lunarProduct = app(ProductSyncService::class)->syncFromLegacy($legacyProduct);

        $this->assertNotNull($lunarProduct);

        return $lunarProduct;
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
