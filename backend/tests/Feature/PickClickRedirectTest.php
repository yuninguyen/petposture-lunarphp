<?php

namespace Tests\Feature;

use App\Models\AffiliateNetwork;
use App\Models\PickMerchant;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Lunar\FieldTypes\Text;
use Lunar\Models\Language;
use Lunar\Models\Product;
use Lunar\Models\ProductOption;
use Lunar\Models\ProductOptionValue;
use Lunar\Models\ProductType;
use Lunar\Models\ProductVariant;
use Lunar\Models\TaxClass;
use Tests\TestCase;

class PickClickRedirectTest extends TestCase
{
    use RefreshDatabase;

    private const CHEWY_URL = 'https://www.chewy.com/necoichi-raised-cat-bowl/dp/123456';

    private function pick(array $fields = [], string $status = 'published', string $slug = 'necoichi-bowl'): Product
    {
        $type = ProductType::query()->firstOrCreate(['name' => 'Pets']);
        $language = Language::query()->firstOrCreate(
            ['code' => 'en'],
            ['name' => 'English', 'default' => true],
        );

        $attributes = ['name' => new Text('Necoichi bowl')];
        foreach (array_merge(['external_url' => self::CHEWY_URL, 'affiliate_network_slug' => 'chewy'], $fields) as $handle => $value) {
            $attributes[$handle] = new Text($value);
        }

        $product = Product::query()->create([
            'product_type_id' => $type->id,
            'status' => $status,
            'attribute_data' => $attributes,
        ]);
        $product->urls()->delete();
        $product->urls()->create(['language_id' => $language->id, 'slug' => $slug, 'default' => true]);

        return $product;
    }

    private function network(string $slug = 'chewy'): AffiliateNetwork
    {
        // Migrations already seed the common networks (chewy, amazon…).
        return AffiliateNetwork::query()->firstOrCreate(['slug' => $slug], ['name' => ucfirst($slug), 'active' => true]);
    }

    public function test_a_pick_click_is_recorded_and_redirects_to_the_retailer(): void
    {
        $network = $this->network();
        $product = $this->pick();

        $this->get('/go/pick/necoichi-bowl', ['Referer' => 'https://petposture.com/picks/necoichi-bowl'])
            ->assertRedirect(self::CHEWY_URL);

        $this->assertDatabaseHas('affiliate_clicks', [
            'post_id' => null,
            'product_id' => $product->id,
            'affiliate_network_id' => $network->id,
            'product_name' => 'Necoichi bowl',
            'target_url' => self::CHEWY_URL,
            'referrer' => 'https://petposture.com/picks/necoichi-bowl',
        ]);
    }

    private function colourVariants(Product $product, array $blackAttributes): ProductVariant
    {
        $option = ProductOption::query()->create(['name' => ['en' => 'Colour'], 'label' => ['en' => 'Colour'], 'handle' => 'colour', 'shared' => false]);
        $camoValue = ProductOptionValue::query()->create(['product_option_id' => $option->id, 'name' => ['en' => 'Camo'], 'position' => 1]);
        $blackValue = ProductOptionValue::query()->create(['product_option_id' => $option->id, 'name' => ['en' => 'Black'], 'position' => 2]);
        $product->productOptions()->attach([$option->id => ['position' => 1]]);

        $camo = $product->variants()->create(['tax_class_id' => TaxClass::query()->firstOrCreate(['name' => 'Default Tax'], ['default' => true])->id, 'sku' => 'CAMO', 'attribute_data' => collect()]);
        $camo->values()->sync([$camoValue->id]);
        $black = $product->variants()->create(['tax_class_id' => $camo->tax_class_id, 'sku' => 'BLACK', 'attribute_data' => collect(array_map(fn ($value) => new Text($value), $blackAttributes))]);
        $black->values()->sync([$blackValue->id]);

        return $black;
    }

    public function test_a_variant_with_its_own_link_redirects_there_and_the_click_names_the_variant(): void
    {
        $product = $this->pick();
        $black = $this->colourVariants($product, ['external_url' => 'https://www.chewy.com/black/dp/2']);

        $this->get("/go/pick/necoichi-bowl?variant={$black->id}")->assertRedirect('https://www.chewy.com/black/dp/2');

        $this->assertDatabaseHas('affiliate_clicks', ['product_id' => $product->id, 'product_name' => 'Necoichi bowl (Black)', 'target_url' => 'https://www.chewy.com/black/dp/2']);
    }

    public function test_an_unknown_foreign_or_linkless_variant_falls_back_to_the_product_link(): void
    {
        $product = $this->pick();
        $black = $this->colourVariants($product, []);
        $other = $this->pick([], 'published', 'other-bowl');
        $foreign = $other->variants()->create(['tax_class_id' => $black->tax_class_id, 'sku' => 'FOREIGN', 'attribute_data' => collect(['external_url' => new Text('https://www.chewy.com/foreign/dp/9')])]);

        $this->get("/go/pick/necoichi-bowl?variant={$black->id}")->assertRedirect(self::CHEWY_URL);
        $this->get('/go/pick/necoichi-bowl?variant=99999')->assertRedirect(self::CHEWY_URL);
        $this->get('/go/pick/necoichi-bowl?variant=abc')->assertRedirect(self::CHEWY_URL);
        $this->get("/go/pick/necoichi-bowl?variant={$foreign->id}")->assertRedirect(self::CHEWY_URL);
    }

    public function test_an_unknown_retailer_slug_still_redirects_and_records_the_click_without_a_network(): void
    {
        $product = $this->pick(['affiliate_network_slug' => 'not-a-network']);

        $this->get('/go/pick/necoichi-bowl')->assertRedirect(self::CHEWY_URL);

        $this->assertDatabaseHas('affiliate_clicks', [
            'product_id' => $product->id,
            'affiliate_network_id' => null,
        ]);
    }

    public function test_an_unknown_slug_is_not_found_and_records_nothing(): void
    {
        $this->get('/go/pick/does-not-exist')->assertNotFound();

        $this->assertDatabaseCount('affiliate_clicks', 0);
    }

    public function test_a_draft_pick_is_not_found_and_records_nothing(): void
    {
        $this->pick(status: 'draft');

        $this->get('/go/pick/necoichi-bowl')->assertNotFound();

        $this->assertDatabaseCount('affiliate_clicks', 0);
    }

    public function test_a_product_without_a_retailer_url_is_not_found_and_records_nothing(): void
    {
        $this->pick(['external_url' => '']);

        $this->get('/go/pick/necoichi-bowl')->assertNotFound();

        $this->assertDatabaseCount('affiliate_clicks', 0);
    }

    private const PETSMART_URL = 'https://www.petsmart.com/dog/toys/chew-toys/benebone-maple-stick-dog-chew-toy-94595.html';

    private const AMAZON_URL = 'https://www.amazon.com/rabbitgoo-example/dp/B0EXAMPLE01';

    /** Adds another store to the end of a Pick's list of stores. */
    private function store(Product $product, string $slug, string $url): PickMerchant
    {
        return PickMerchant::query()->create([
            'product_id' => $product->id,
            'position' => ((int) PickMerchant::query()->where('product_id', $product->id)->max('position')) + 1,
            'affiliate_network_id' => $this->network($slug)->id,
            'url' => $url,
        ]);
    }

    public function test_a_store_click_is_recorded_against_its_network_and_redirects_to_its_page(): void
    {
        $this->network('chewy');
        $petsmart = $this->network('petsmart');
        $product = $this->pick();
        $store = $this->store($product, 'petsmart', self::PETSMART_URL);

        $this->get("/go/pick/necoichi-bowl?merchant={$store->id}", ['Referer' => 'https://petposture.com/picks/necoichi-bowl'])
            ->assertRedirect(self::PETSMART_URL);

        $this->assertDatabaseHas('affiliate_clicks', [
            'product_id' => $product->id,
            'affiliate_network_id' => $petsmart->id,
            'product_name' => 'Necoichi bowl',
            'target_url' => self::PETSMART_URL,
            'referrer' => 'https://petposture.com/picks/necoichi-bowl',
        ]);
        $this->assertDatabaseCount('affiliate_clicks', 1);
    }

    public function test_an_amazon_pick_is_recorded_against_the_amazon_network_and_redirects_to_the_amazon_page(): void
    {
        $chewy = $this->network('chewy');
        $amazon = $this->network('amazon');
        $product = $this->pick(['external_url' => self::AMAZON_URL, 'affiliate_network_slug' => 'amazon']);

        $this->get('/go/pick/necoichi-bowl', ['Referer' => 'https://petposture.com/picks/necoichi-bowl'])
            ->assertRedirect(self::AMAZON_URL);

        $this->assertDatabaseHas('affiliate_clicks', [
            'product_id' => $product->id,
            'affiliate_network_id' => $amazon->id,
            'target_url' => self::AMAZON_URL,
            'referrer' => 'https://petposture.com/picks/necoichi-bowl',
        ]);
        $this->assertDatabaseMissing('affiliate_clicks', ['affiliate_network_id' => $chewy->id]);
        $this->assertDatabaseCount('affiliate_clicks', 1);
    }

    public function test_each_store_on_the_list_has_its_own_link_and_its_click_goes_to_its_own_network(): void
    {
        $chewy = $this->network('chewy');
        $amazon = $this->network('amazon');
        $petsmart = $this->network('petsmart');
        $product = $this->pick();
        $first = $this->store($product, 'amazon', self::AMAZON_URL);
        $second = $this->store($product, 'petsmart', self::PETSMART_URL);

        $this->get("/go/pick/necoichi-bowl?merchant={$second->id}")->assertRedirect(self::PETSMART_URL);
        $this->get("/go/pick/necoichi-bowl?merchant={$first->id}")->assertRedirect(self::AMAZON_URL);
        // the plain link of the same Pick still goes to Chewy, counted against Chewy
        $this->get('/go/pick/necoichi-bowl')->assertRedirect(self::CHEWY_URL);

        $this->assertDatabaseHas('affiliate_clicks', ['product_id' => $product->id, 'affiliate_network_id' => $petsmart->id, 'target_url' => self::PETSMART_URL]);
        $this->assertDatabaseHas('affiliate_clicks', ['product_id' => $product->id, 'affiliate_network_id' => $amazon->id, 'target_url' => self::AMAZON_URL]);
        $this->assertDatabaseHas('affiliate_clicks', ['product_id' => $product->id, 'affiliate_network_id' => $chewy->id, 'target_url' => self::CHEWY_URL]);
        $this->assertDatabaseCount('affiliate_clicks', 3);
    }

    public function test_the_older_retailer_second_link_means_the_first_of_the_other_stores(): void
    {
        $this->network('chewy');
        $product = $this->pick();
        $this->store($product, 'amazon', self::AMAZON_URL);
        $this->store($product, 'petsmart', self::PETSMART_URL);

        $this->get('/go/pick/necoichi-bowl?retailer=second')->assertRedirect(self::AMAZON_URL);
    }

    public function test_a_store_never_falls_back_to_the_first_retailers_link(): void
    {
        $this->network('chewy');
        $this->network('petsmart');
        $other = $this->pick(slug: 'other-pick');
        $foreign = $this->store($other, 'petsmart', self::PETSMART_URL);

        // no stores, a store that is not on this Pick, one that does not exist, and a link that is not a web address
        $this->pick(slug: 'second-0');
        $this->get('/go/pick/second-0?retailer=second')->assertNotFound();
        $this->get("/go/pick/second-0?merchant={$foreign->id}")->assertNotFound();
        $this->get('/go/pick/second-0?merchant=999999')->assertNotFound();

        $broken = $this->pick(slug: 'second-1');
        $this->store($broken, 'petsmart', 'javascript:alert(1)');
        $this->get('/go/pick/second-1?retailer=second')->assertNotFound();

        $this->assertDatabaseCount('affiliate_clicks', 0);
    }

    public function test_only_the_exact_value_second_or_a_number_for_merchant_asks_for_another_store(): void
    {
        $this->network('chewy');
        $product = $this->pick();
        $this->store($product, 'petsmart', self::PETSMART_URL);

        $this->get('/go/pick/necoichi-bowl?retailer=petsmart')->assertRedirect(self::CHEWY_URL);
        $this->get('/go/pick/necoichi-bowl?retailer=')->assertRedirect(self::CHEWY_URL);
        $this->get('/go/pick/necoichi-bowl?merchant=abc')->assertRedirect(self::CHEWY_URL);
        $this->get('/go/pick/necoichi-bowl?merchant=')->assertRedirect(self::CHEWY_URL);
        $this->get('/go/pick/necoichi-bowl')->assertRedirect(self::CHEWY_URL);
    }

    public function test_only_http_and_https_urls_are_followed(): void
    {
        foreach (['javascript:alert(1)', 'ftp://example.com/file', '//evil.example', 'not a url'] as $index => $url) {
            $this->pick(['external_url' => $url], slug: "bad-url-{$index}");

            $this->get("/go/pick/bad-url-{$index}")->assertNotFound();
        }

        $this->assertDatabaseCount('affiliate_clicks', 0);
    }
}
