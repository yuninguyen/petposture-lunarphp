<?php

namespace Tests\Feature;

use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Lunar\FieldTypes\Text;
use Lunar\Models\Attribute;
use Lunar\Models\AttributeGroup;
use Lunar\Models\Currency;
use Lunar\Models\CustomerGroup;
use Lunar\Models\Product;
use Lunar\Models\ProductOption;
use Lunar\Models\ProductOptionValue;
use Lunar\Models\ProductType;
use Lunar\Models\ProductVariant;
use Lunar\Models\TaxClass;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class AdminProductApiTest extends TestCase
{
    use RefreshDatabase;

    private Currency $currency;

    private TaxClass $taxClass;

    private ProductType $productType;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(RoleSeeder::class);
        $this->currency = Currency::query()->create([
            'code' => 'BHD',
            'name' => 'Bahraini Dinar',
            'exchange_rate' => 1,
            'decimal_places' => 3,
            'enabled' => true,
            'default' => true,
            'sync_prices' => false,
        ]);
        $this->taxClass = TaxClass::query()->create(['name' => 'Default Tax', 'default' => true]);
        $this->productType = ProductType::query()->create(['name' => 'Pet Products']);

        $group = AttributeGroup::query()->create([
            'attributable_type' => Product::morphName(),
            'name' => ['en' => 'Product details'],
            'handle' => 'product_details',
            'position' => 1,
        ]);
        $name = Attribute::query()->create([
            'attribute_type' => Product::morphName(),
            'attribute_group_id' => $group->id,
            'position' => 1,
            'name' => ['en' => 'Name'],
            'description' => ['en' => ''],
            'handle' => 'name',
            'section' => 'main',
            'type' => Text::class,
            'required' => true,
            'default_value' => null,
            'configuration' => [],
            'system' => true,
            'validation_rules' => null,
            'filterable' => false,
            'searchable' => true,
        ]);
        $this->productType->mappedAttributes()->attach($name->id);
    }

    public function test_order_scoped_product_picker_requires_update_order_not_view_any_order(): void
    {
        [$product, $variant] = $this->productWithVariant();

        $this->getJson('/api/admin/orders/product-picker?search=Orthopedic')->assertUnauthorized();
        $this->getJson("/api/admin/orders/product-picker/{$product->id}/variants")->assertUnauthorized();

        Role::findByName('Support')->revokePermissionTo('view_any_order');
        $support = $this->userWithRole('Support');
        $this->assertFalse($support->can('view_any_order'));
        $this->assertTrue($support->can('update_order'));
        Sanctum::actingAs($support);

        $this->getJson('/api/admin/orders/product-picker?search=Orthopedic')
            ->assertOk()
            ->assertExactJson(['data' => [['id' => $product->id, 'name' => 'Orthopedic Bowl']]]);
        $this->getJson("/api/admin/orders/product-picker/{$product->id}/variants")
            ->assertOk()
            ->assertJsonPath('data.0.id', $variant->id)
            ->assertJsonStructure(['data' => [['id', 'sku', 'label', 'price', 'formatted_price', 'stock', 'purchasable']]]);

        Sanctum::actingAs($this->userWithRole('Product Manager'));
        $this->getJson('/api/admin/orders/product-picker?search=Orthopedic')->assertForbidden();
        $this->getJson("/api/admin/orders/product-picker/{$product->id}/variants")->assertForbidden();
    }

    public function test_order_scoped_variant_picker_returns_null_when_no_qualifying_base_price_exists(): void
    {
        [$product, $variant] = $this->productWithVariant();
        $variant->prices()->delete();
        Sanctum::actingAs($this->userWithRole('Order Manager'));

        $this->getJson("/api/admin/orders/product-picker/{$product->id}/variants")
            ->assertOk()
            ->assertJsonPath('data.0.price', null)
            ->assertJsonPath('data.0.formatted_price', null);
    }

    public function test_order_scoped_variant_picker_uses_only_the_default_base_price(): void
    {
        [$product, $variant, $basePrice] = $this->productWithVariant();
        $customerGroup = CustomerGroup::query()->create(['name' => 'Wholesale', 'handle' => 'wholesale', 'default' => false]);
        $foreignCurrency = Currency::query()->create([
            'code' => 'JPY',
            'name' => 'Japanese Yen',
            'exchange_rate' => 1,
            'decimal_places' => 0,
            'enabled' => true,
            'default' => false,
            'sync_prices' => false,
        ]);
        $variant->prices()->create(['currency_id' => $foreignCurrency->id, 'customer_group_id' => null, 'min_quantity' => 1, 'price' => 99]);
        $variant->prices()->create(['currency_id' => $this->currency->id, 'customer_group_id' => $customerGroup->id, 'min_quantity' => 1, 'price' => 100]);
        $variant->prices()->create(['currency_id' => $this->currency->id, 'customer_group_id' => null, 'min_quantity' => 2, 'price' => 101]);
        Sanctum::actingAs($this->userWithRole('Support'));

        $this->getJson("/api/admin/orders/product-picker/{$product->id}/variants")
            ->assertOk()
            ->assertJsonPath('data.0.price', 12500)
            ->assertJsonPath('data.0.formatted_price', $basePrice->price->formatted());
    }

    public function test_product_index_search_response_does_not_include_variants(): void
    {
        [$product] = $this->productWithVariant();
        Sanctum::actingAs($this->userWithRole('Product Manager'));

        $this->getJson('/api/admin/products?search=BOWL-RED-S')
            ->assertOk()
            ->assertJsonPath('data.0.id', $product->id)
            ->assertJsonMissingPath('data.0.variants');
    }

    private function productWithVariant(): array
    {
        $product = Product::query()->create([
            'product_type_id' => $this->productType->id,
            'status' => 'published',
            'attribute_data' => ['name' => new Text('Orthopedic Bowl')],
        ]);
        $option = ProductOption::query()->create([
            'name' => ['en' => 'Color'],
            'label' => ['en' => 'Color'],
            'handle' => 'color',
            'shared' => true,
        ]);
        $size = ProductOption::query()->create([
            'name' => ['en' => 'Size'],
            'label' => ['en' => 'Size'],
            'handle' => 'size',
            'shared' => true,
        ]);
        $red = ProductOptionValue::query()->create([
            'product_option_id' => $option->id,
            'name' => ['en' => 'Red'],
            'position' => 1,
        ]);
        $small = ProductOptionValue::query()->create([
            'product_option_id' => $size->id,
            'name' => ['en' => 'Small'],
            'position' => 1,
        ]);
        $product->productOptions()->attach([$option->id => ['position' => 1], $size->id => ['position' => 2]]);
        $variant = $product->variants()->create([
            'tax_class_id' => $this->taxClass->id,
            'sku' => 'BOWL-RED-S',
            'stock' => 7,
            'backorder' => 0,
            'purchasable' => 'in_stock',
            'unit_quantity' => 1,
            'min_quantity' => 1,
            'quantity_increment' => 1,
            'shippable' => true,
        ]);
        $variant->values()->attach([$red->id, $small->id]);
        $price = $variant->prices()->create([
            'currency_id' => $this->currency->id,
            'customer_group_id' => null,
            'min_quantity' => 1,
            'price' => 12500,
        ]);

        return [$product, $variant, $price];
    }

    private function userWithRole(string $role): User
    {
        $user = User::factory()->create();
        $user->assignRole($role);

        return $user;
    }
}
