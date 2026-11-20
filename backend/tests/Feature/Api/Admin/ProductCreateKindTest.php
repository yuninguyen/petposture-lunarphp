<?php

namespace Tests\Feature\Api\Admin;

use App\Models\User;
use App\Support\PickKind;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Lunar\FieldTypes\Text;
use Lunar\Models\Attribute;
use Lunar\Models\AttributeGroup;
use Lunar\Models\Currency;
use Lunar\Models\Product;
use Lunar\Models\ProductType;
use Lunar\Models\TaxClass;
use Tests\TestCase;

/**
 * A Pick is a product with a retailer link, a Shop product has none. The create form lets the person choose which
 * one they are making, and the API refuses the two states that would contradict that choice: a Pick without a
 * link, and a Shop product with one.
 */
class ProductCreateKindTest extends TestCase
{
    use RefreshDatabase;

    private ProductType $general;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
        Sanctum::actingAs(User::factory()->create()->assignRole('admin'));

        // The migrations may already have seeded a default currency and tax class.
        Currency::getDefault() ?? Currency::query()->create(['code' => 'USD', 'name' => 'US Dollar', 'exchange_rate' => 1, 'decimal_places' => 2, 'enabled' => true, 'default' => true, 'sync_prices' => false]);
        TaxClass::getDefault() ?? TaxClass::query()->create(['name' => 'Default Tax', 'default' => true]);
        $this->general = ProductType::query()->create(['name' => 'General']);

        $group = AttributeGroup::query()->create(['attributable_type' => Product::morphName(), 'name' => ['en' => 'Details'], 'handle' => 'product_details', 'position' => 1]);
        $name = $this->attribute($group, 'name', true, 1);
        $url = $this->attribute($group, 'external_url', false, 2);
        $this->general->mappedAttributes()->syncWithoutDetaching([$name->id, $url->id]);
    }

    private function attribute(AttributeGroup $group, string $handle, bool $required, int $position): Attribute
    {
        return Attribute::query()->firstOrCreate(
            ['attribute_type' => Product::morphName(), 'handle' => $handle],
            [
                'attribute_group_id' => $group->id, 'position' => $position, 'name' => ['en' => ucfirst($handle)], 'section' => null,
                'type' => Text::class, 'required' => $required, 'default_value' => null, 'configuration' => ['richtext' => false],
                'system' => $handle === 'name', 'validation_rules' => null, 'filterable' => false, 'searchable' => false,
            ],
        );
    }

    private function create(array $extra = [], string $sku = 'SKU-1')
    {
        return $this->postJson('/api/admin/products', array_merge([
            'name' => 'A product', 'product_type_id' => $this->general->id, 'sku' => $sku, 'base_price' => '9.99',
        ], $extra));
    }

    private function product(?string $url): Product
    {
        $attributes = ['name' => new Text('Existing')];
        if ($url !== null) {
            $attributes['external_url'] = new Text($url);
        }

        return Product::query()->create(['product_type_id' => $this->general->id, 'status' => 'draft', 'attribute_data' => $attributes]);
    }

    private function update(Product $product, array $attributes)
    {
        return $this->putJson("/api/admin/products/{$product->id}", ['status' => 'draft', 'attributes' => array_merge(['name' => 'Existing'], $attributes)]);
    }

    public function test_a_pick_is_created_with_its_retailer_link_and_is_listed_as_a_pick(): void
    {
        $id = $this->create(['kind' => 'pick', 'external_url' => '  https://www.chewy.com/a/dp/1  '])
            ->assertCreated()->assertJsonPath('data.kind', 'pick')->json('data.id');

        $product = Product::query()->findOrFail($id);

        $this->assertSame('https://www.chewy.com/a/dp/1', $product->translateAttribute('external_url'));
        $this->assertSame(PickKind::PICK, PickKind::of($product));
        $this->assertSame('pick', collect($this->getJson('/api/admin/products?per_page=50')->json('data'))->firstWhere('id', $id)['kind']);
    }

    public function test_a_pick_without_a_web_link_is_refused_and_nothing_is_created(): void
    {
        $this->create(['kind' => 'pick'])->assertUnprocessable()->assertJsonValidationErrors('external_url');
        $this->create(['kind' => 'pick', 'external_url' => '   '], 'SKU-2')->assertUnprocessable()->assertJsonValidationErrors('external_url');
        $this->create(['kind' => 'pick', 'external_url' => 'ftp://files.example.com/x'], 'SKU-3')->assertUnprocessable()->assertJsonValidationErrors('external_url');
        $this->create(['kind' => 'pick', 'external_url' => 'chewy.com/a'], 'SKU-4')->assertUnprocessable()->assertJsonValidationErrors('external_url');

        $this->assertSame(0, Product::query()->count());
    }

    public function test_a_shop_product_is_created_without_a_link_and_is_listed_as_a_shop_product(): void
    {
        $id = $this->create(['kind' => 'shop'])->assertCreated()->assertJsonPath('data.kind', 'shop')->json('data.id');

        $product = Product::query()->findOrFail($id);

        $this->assertNull($product->translateAttribute('external_url'));
        $this->assertSame(PickKind::SHOP, PickKind::of($product));
    }

    public function test_a_shop_product_with_a_link_is_refused(): void
    {
        $this->create(['kind' => 'shop', 'external_url' => 'https://www.chewy.com/a/dp/1'])
            ->assertUnprocessable()->assertJsonValidationErrors('external_url');

        $this->assertSame(0, Product::query()->count());
    }

    public function test_an_unknown_kind_is_refused_and_no_kind_keeps_the_old_behaviour(): void
    {
        $this->create(['kind' => 'gift'])->assertUnprocessable()->assertJsonValidationErrors('kind');

        $this->create([], 'SKU-9')->assertCreated()->assertJsonPath('data.kind', 'shop');
    }

    public function test_a_pick_cannot_lose_its_link_when_it_is_saved(): void
    {
        $pick = $this->product('https://www.chewy.com/a/dp/1');

        $this->update($pick, ['external_url' => ''])->assertUnprocessable()->assertJsonValidationErrors('attributes.external_url');
        $this->update($pick, ['external_url' => 'not a link'])->assertUnprocessable()->assertJsonValidationErrors('attributes.external_url');

        $this->assertSame('https://www.chewy.com/a/dp/1', $pick->fresh()->translateAttribute('external_url'));
    }

    public function test_a_pick_saved_without_touching_the_link_field_keeps_its_link(): void
    {
        $pick = $this->product('https://www.chewy.com/a/dp/1');

        $this->update($pick, [])->assertOk()->assertJsonPath('data.kind', 'pick');

        $this->assertSame('https://www.chewy.com/a/dp/1', $pick->fresh()->translateAttribute('external_url'));
    }

    public function test_a_shop_product_cannot_get_a_link_that_is_not_a_web_address_but_may_become_a_pick_with_a_good_one(): void
    {
        $shop = $this->product(null);

        $this->update($shop, ['external_url' => 'ftp://files.example.com/x'])->assertUnprocessable()->assertJsonValidationErrors('attributes.external_url');
        $this->update($shop, ['external_url' => ''])->assertOk()->assertJsonPath('data.kind', 'shop');
        $this->update($shop, ['external_url' => 'https://www.chewy.com/b/dp/2'])->assertOk()->assertJsonPath('data.kind', 'pick');

        $this->assertSame(PickKind::PICK, PickKind::of($shop->fresh()));
    }

    public function test_the_product_detail_says_which_kind_it_is(): void
    {
        $pick = $this->product('https://www.chewy.com/a/dp/1');
        $shop = $this->product(null);

        $this->getJson("/api/admin/products/{$pick->id}")->assertOk()->assertJsonPath('data.kind', 'pick');
        $this->getJson("/api/admin/products/{$shop->id}")->assertOk()->assertJsonPath('data.kind', 'shop');
    }
}
