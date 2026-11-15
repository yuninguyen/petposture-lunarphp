<?php

namespace Tests\Feature;

use App\Models\AffiliateNetwork;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Lunar\FieldTypes\Text;
use Lunar\Models\Currency;
use Lunar\Models\Language;
use Lunar\Models\Product;
use Lunar\Models\ProductType;
use Lunar\Models\TaxClass;
use Tests\TestCase;

class ProductPickApiTest extends TestCase
{
    use RefreshDatabase;

    private const CHEWY_URL = 'https://www.chewy.com/necoichi-raised-cat-bowl/dp/123456';

    private function pick(array $fields = [], string $slug = 'necoichi-bowl'): Product
    {
        $currency = Currency::query()->firstOrCreate(['code' => 'USD'], [
            'name' => 'US Dollar', 'exchange_rate' => 1, 'decimal_places' => 2, 'enabled' => true, 'default' => true, 'sync_prices' => false,
        ]);
        $taxClass = TaxClass::query()->firstOrCreate(['name' => 'Default Tax'], ['default' => true]);
        $type = ProductType::query()->firstOrCreate(['name' => 'Pets']);
        $language = Language::query()->firstOrCreate(['code' => 'en'], ['name' => 'English', 'default' => true]);

        $defaults = [
            'name' => 'Necoichi bowl',
            'external_url' => self::CHEWY_URL,
            'affiliate_network_slug' => 'chewy',
            'reference_price' => '49.96',
            'price_checked_date' => '2026-11-14',
            'best_for_breeds' => 'french-bulldog, Pug',
            'pros' => "Raised design\nEasy to clean",
            'cons' => "Holds about one cup\n",
        ];
        $attributes = [];
        foreach (array_merge($defaults, $fields) as $handle => $value) {
            $attributes[$handle] = new Text($value);
        }

        $product = Product::query()->create([
            'product_type_id' => $type->id,
            'status' => 'published',
            'attribute_data' => $attributes,
        ]);
        $product->urls()->delete();
        $product->urls()->create(['language_id' => $language->id, 'slug' => $slug, 'default' => true]);

        $variant = $product->variants()->create([
            'tax_class_id' => $taxClass->id, 'sku' => "SKU-{$slug}", 'stock' => 5, 'backorder' => 0,
            'purchasable' => 'always', 'unit_quantity' => 1, 'min_quantity' => 1, 'quantity_increment' => 1,
            'shippable' => true, 'attribute_data' => [],
        ]);
        $variant->prices()->create(['currency_id' => $currency->id, 'customer_group_id' => null, 'min_quantity' => 1, 'price' => 2271]);

        return $product;
    }

    private function listed(string $slug = 'necoichi-bowl'): array
    {
        $item = collect($this->getJson('/api/products?per_page=100')->assertOk()->json('data'))->firstWhere('slug', $slug);
        $this->assertNotNull($item, "{$slug} is not in the public listing");

        return $item;
    }

    public function test_a_product_with_a_retailer_url_exposes_a_pick_block(): void
    {
        AffiliateNetwork::query()->firstOrCreate(['slug' => 'chewy'], ['name' => 'Chewy', 'active' => true]);
        $this->pick();

        $pick = $this->listed()['pick'];

        $this->assertSame('chewy', $pick['retailer']);
        $this->assertSame('Chewy', $pick['retailerName']);
        $this->assertSame(url('/go/pick/necoichi-bowl'), $pick['goUrl']);
        $this->assertSame(49.96, $pick['referencePrice']);
        $this->assertSame('2026-11-14', $pick['priceCheckedDate']);
        $this->assertSame(['french-bulldog', 'pug'], $pick['bestForBreeds']);
        $this->assertSame(['Raised design', 'Easy to clean'], $pick['pros']);
        $this->assertSame(['Holds about one cup'], $pick['cons']);
    }

    public function test_the_retailer_url_itself_is_never_exposed_so_clicks_cannot_skip_tracking(): void
    {
        $this->pick();

        $this->assertStringNotContainsString('chewy.com', json_encode($this->listed()));
    }

    public function test_a_product_without_a_retailer_url_has_no_pick_block(): void
    {
        $this->pick(['external_url' => '']);

        $this->assertNull($this->listed()['pick']);
    }

    public function test_a_retailer_url_that_is_not_http_has_no_pick_block(): void
    {
        $this->pick(['external_url' => 'javascript:alert(1)']);

        $this->assertNull($this->listed()['pick']);
    }

    public function test_the_reference_price_is_withheld_without_a_valid_checked_date(): void
    {
        foreach (['' => 'no-date', 'yesterday' => 'bad-text', '2026-13-45' => 'bad-date'] as $date => $slug) {
            $this->pick(['price_checked_date' => (string) $date], $slug);

            $pick = $this->listed($slug)['pick'];

            $this->assertNull($pick['referencePrice'], "price must be hidden for date '{$date}'");
            $this->assertNull($pick['priceCheckedDate']);
        }
    }

    public function test_a_reference_price_that_is_not_a_number_is_withheld(): void
    {
        $this->pick(['reference_price' => 'about fifty']);

        $this->assertNull($this->listed()['pick']['referencePrice']);
    }

    public function test_a_pick_json_ld_has_no_offers_or_aggregate_rating(): void
    {
        $this->pick();

        $seo = $this->listed()['seo'];

        $this->assertArrayNotHasKey('offers', $seo);
        $this->assertArrayNotHasKey('aggregateRating', $seo);
    }

    public function test_an_ordinary_product_keeps_its_offers_json_ld(): void
    {
        $this->pick(['external_url' => '']);

        $this->assertArrayHasKey('offers', $this->listed()['seo']);
    }
}
