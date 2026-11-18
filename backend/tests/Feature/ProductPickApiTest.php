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
        $this->assertSame(rtrim((string) config('app.frontend_url'), '/').'/go/pick/necoichi-bowl', $pick['goUrl']);
        $this->assertSame(49.96, $pick['referencePrice']);
        $this->assertSame('2026-11-14', $pick['priceCheckedDate']);
        $this->assertSame(['french-bulldog', 'pug'], $pick['bestForBreeds']);
        $this->assertSame(['Raised design', 'Easy to clean'], $pick['pros']);
        $this->assertSame(['Holds about one cup'], $pick['cons']);
    }

    public function test_the_go_url_uses_the_storefront_host_even_when_the_storefront_calls_an_internal_host(): void
    {
        // The storefront renders on the server and calls the API at http://127.0.0.1:8001, but a
        // visitor's browser has to be able to open the link, so it must not carry that host, nor the API host.
        config(['app.url' => 'https://api.petposture.com', 'app.frontend_url' => 'https://petposture.com']);
        $this->pick();

        $item = collect($this->withServerVariables(['HTTP_HOST' => '127.0.0.1:8001'])
            ->getJson('/api/products?per_page=100')->assertOk()->json('data'))->firstWhere('slug', 'necoichi-bowl');

        $this->assertSame('https://petposture.com/go/pick/necoichi-bowl', $item['pick']['goUrl']);
    }

    public function test_a_photo_alt_is_the_admin_alt_text_and_never_the_file_name(): void
    {
        \Illuminate\Support\Facades\Storage::fake('local');
        $product = $this->pick();
        $collection = config('lunar.media.collection');
        $product->addMedia(\Illuminate\Http\UploadedFile::fake()->image('kong-puppy.jpg'))
            ->withCustomProperties(['primary' => true, 'alt' => 'Necoichi bowl, Gray, Large'])
            ->toMediaCollection($collection);
        $product->addMedia(\Illuminate\Http\UploadedFile::fake()->image('side.jpg'))
            ->withCustomProperties(['primary' => false])
            ->toMediaCollection($collection);

        $alts = collect($this->getJson('/api/products/necoichi-bowl')->assertOk()->json('data.images'))->pluck('alt')->all();

        $this->assertSame(['Necoichi bowl, Gray, Large', 'Necoichi bowl'], $alts);
    }

    /** Gives the product's variant a Colour of Camo and adds a second variant with Black; returns [camo, black]. */
    private function colourVariants(Product $product, array $camoAttributes = [], array $blackAttributes = []): array
    {
        $option = \Lunar\Models\ProductOption::query()->create(['name' => ['en' => 'Colour'], 'label' => ['en' => 'Colour'], 'handle' => 'colour', 'shared' => false]);
        $camoValue = \Lunar\Models\ProductOptionValue::query()->create(['product_option_id' => $option->id, 'name' => ['en' => 'Camo'], 'position' => 1]);
        $blackValue = \Lunar\Models\ProductOptionValue::query()->create(['product_option_id' => $option->id, 'name' => ['en' => 'Black'], 'position' => 2]);
        $product->productOptions()->attach([$option->id => ['position' => 1]]);

        $camo = $product->variants()->firstOrFail();
        $camo->values()->sync([$camoValue->id]);
        $camo->update(['attribute_data' => collect(array_map(fn ($value) => new Text($value), $camoAttributes))]);

        $black = $camo->replicate();
        $black->sku = 'SKU-black';
        $black->attribute_data = collect(array_map(fn ($value) => new Text($value), $blackAttributes));
        $black->save();
        $black->values()->sync([$blackValue->id]);

        return [$camo->fresh(), $black->fresh()];
    }

    public function test_a_pick_with_two_variants_lists_them_with_their_own_price_and_go_link(): void
    {
        config(['app.frontend_url' => 'https://petposture.com']);
        $product = $this->pick();
        [$camo, $black] = $this->colourVariants($product, [], ['reference_price' => '49.95', 'external_url' => 'https://www.chewy.com/black/dp/2']);

        $pick = $this->listed()['pick'];

        $this->assertSame([
            ['id' => $camo->id, 'label' => 'Camo', 'options' => [['name' => 'Colour', 'value' => 'Camo']], 'referencePrice' => 49.96, 'goUrl' => "https://petposture.com/go/pick/necoichi-bowl?variant={$camo->id}"],
            ['id' => $black->id, 'label' => 'Black', 'options' => [['name' => 'Colour', 'value' => 'Black']], 'referencePrice' => 49.95, 'goUrl' => "https://petposture.com/go/pick/necoichi-bowl?variant={$black->id}"],
        ], $pick['variants']);
        $this->assertStringNotContainsString('chewy.com/black', json_encode($pick), 'a variant retailer URL must not be exposed');
    }

    public function test_a_pick_with_one_variant_has_no_variant_list(): void
    {
        $this->pick();

        $this->assertSame([], $this->listed()['pick']['variants']);
    }

    public function test_variant_prices_are_withheld_without_a_checked_date_like_the_product_price(): void
    {
        $product = $this->pick(['price_checked_date' => '']);
        $this->colourVariants($product, [], ['reference_price' => '49.95']);

        $this->assertSame([null, null], collect($this->listed()['pick']['variants'])->pluck('referencePrice')->all());
    }

    public function test_the_story_fields_are_exposed_and_parsed(): void
    {
        $this->pick([
            'our_take' => "  Based on the seller's description and customer reviews.\n",
            'best_for_note' => "Pug & flat-faced breeds\n\nSmall, split meals\n",
            'problem' => 'A flat bowl makes a flat-faced dog bend its neck.',
            'approach' => 'A tilted, raised shape brings the food closer.',
            'quick_specs' => "Material: Porcelain\nTilt: 15°\nSize: 6 in: wide\nno colon here\n: no label\nNo value:\n",
        ]);

        $pick = $this->listed()['pick'];

        $this->assertSame("Based on the seller's description and customer reviews.", $pick['ourTake']);
        $this->assertSame(['Pug & flat-faced breeds', 'Small, split meals'], $pick['bestForNotes']);
        $this->assertSame('A flat bowl makes a flat-faced dog bend its neck.', $pick['problem']);
        $this->assertSame('A tilted, raised shape brings the food closer.', $pick['approach']);
        $this->assertSame([
            ['label' => 'Material', 'value' => 'Porcelain'],
            ['label' => 'Tilt', 'value' => '15°'],
            ['label' => 'Size', 'value' => '6 in: wide'],
        ], $pick['quickSpecs']);
    }

    public function test_empty_story_fields_are_null_or_empty_so_the_page_can_hide_them(): void
    {
        $this->pick();

        $pick = $this->listed()['pick'];

        $this->assertNull($pick['ourTake']);
        $this->assertSame([], $pick['bestForNotes']);
        $this->assertNull($pick['problem']);
        $this->assertNull($pick['approach']);
        $this->assertSame([], $pick['quickSpecs']);
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
