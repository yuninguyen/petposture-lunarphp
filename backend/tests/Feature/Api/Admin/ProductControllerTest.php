<?php

namespace Tests\Feature\Api\Admin;

use App\Models\CuratorMedia;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Lunar\FieldTypes\Text;
use Lunar\FieldTypes\TranslatedText;
use Lunar\Models\Attribute;
use Lunar\Models\AttributeGroup;
use Lunar\Models\Brand;
use Lunar\Models\Collection;
use Lunar\Models\CollectionGroup;
use Lunar\Models\Currency;
use Lunar\Models\CustomerGroup;
use Lunar\Models\Language;
use Lunar\Models\Price;
use Lunar\Models\Product;
use Lunar\Models\ProductOption;
use Lunar\Models\ProductOptionValue;
use Lunar\Models\ProductType;
use Lunar\Models\ProductVariant;
use Lunar\Models\TaxClass;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class ProductControllerTest extends TestCase
{
    use RefreshDatabase;

    private Currency $currency;

    private TaxClass $taxClass;

    private ProductType $productType;

    private Attribute $nameAttribute;

    private Attribute $descriptionAttribute;

    private Attribute $careAttribute;

    private Attribute $variantNoteAttribute;

    protected function setUp(): void
    {
        parent::setUp();

        Role::firstOrCreate(['name' => 'admin', 'guard_name' => 'web']);
        Role::firstOrCreate(['name' => 'customer', 'guard_name' => 'web']);
        Storage::fake('public');

        $this->currency = Currency::query()->create([
            'code' => 'BHD',
            'name' => 'Bahraini Dinar',
            'exchange_rate' => 1,
            'decimal_places' => 3,
            'enabled' => true,
            'default' => true,
            'sync_prices' => false,
        ]);
        $this->taxClass = TaxClass::query()->create([
            'name' => 'Default Tax',
            'default' => true,
        ]);
        $this->productType = ProductType::query()->create(['name' => 'Pet Products']);

        $productGroup = AttributeGroup::query()->create([
            'attributable_type' => Product::morphName(),
            'name' => ['en' => 'Product details'],
            'handle' => 'product_details',
            'position' => 1,
        ]);
        $variantGroup = AttributeGroup::query()->create([
            'attributable_type' => ProductVariant::morphName(),
            'name' => ['en' => 'Variant details'],
            'handle' => 'variant_details',
            'position' => 1,
        ]);

        $this->nameAttribute = $this->attribute($productGroup, Product::morphName(), 'name', Text::class, true, true, 1);
        $this->descriptionAttribute = $this->attribute($productGroup, Product::morphName(), 'description', Text::class, false, false, 2);
        $this->careAttribute = $this->attribute($productGroup, Product::morphName(), 'care', TranslatedText::class, false, false, 3);
        $this->variantNoteAttribute = $this->attribute($variantGroup, ProductVariant::morphName(), 'variant_note', TranslatedText::class, false, false, 1);

        $this->productType->mappedAttributes()->attach([
            $this->nameAttribute->id,
            $this->descriptionAttribute->id,
            $this->careAttribute->id,
            $this->variantNoteAttribute->id,
        ]);
    }

    public function test_product_routes_require_admin_authentication_and_role(): void
    {
        $product = $this->product('Protected product');
        $variant = $this->variant($product, 'PROTECTED-1', 1000);

        $requests = [
            ['getJson', '/api/admin/products', []],
            ['postJson', '/api/admin/products', []],
            ['getJson', "/api/admin/products/{$product->id}", []],
            ['putJson', "/api/admin/products/{$product->id}", []],
            ['deleteJson', "/api/admin/products/{$product->id}", []],
            ['putJson', "/api/admin/products/{$product->id}/variants/{$variant->id}", []],
        ];

        foreach ($requests as [$method, $uri, $payload]) {
            $this->{$method}($uri, $payload)->assertUnauthorized();
        }

        $customer = User::factory()->create();
        $customer->assignRole('customer');
        Sanctum::actingAs($customer);

        foreach ($requests as [$method, $uri, $payload]) {
            $this->{$method}($uri, $payload)->assertForbidden();
        }
    }

    public function test_admin_can_create_product_with_currency_factor_and_text_name(): void
    {
        $this->actingAsAdmin();

        $response = $this->postJson('/api/admin/products', [
            'name' => 'Posture Bowl',
            'product_type_id' => $this->productType->id,
            'sku' => 'BOWL-001',
            'base_price' => '12.345',
        ])->assertCreated()
            ->assertJsonPath('data.status', 'draft')
            ->assertJsonPath('data.product_type_id', $this->productType->id)
            ->assertJsonPath('data.variants.0.sku', 'BOWL-001')
            ->assertJsonPath('data.variants.0.base_price', '12.345');

        $product = Product::query()->findOrFail($response->json('data.id'));
        $variant = $product->variants()->sole();
        $price = $variant->prices()->sole();

        $this->assertInstanceOf(Text::class, $product->attribute_data->get('name'));
        $this->assertSame('Posture Bowl', $product->attribute_data->get('name')->getValue());
        $this->assertSame($this->taxClass->id, $variant->tax_class_id);
        $this->assertSame($this->currency->id, $price->currency_id);
        $this->assertNull($price->customer_group_id);
        $this->assertSame(1, $price->min_quantity);
        $this->assertSame(12345, (int) $price->getRawOriginal('price'));
    }

    public function test_create_uses_translated_text_name_definition_when_configured(): void
    {
        $this->nameAttribute->update(['type' => TranslatedText::class]);
        $this->actingAsAdmin();

        $response = $this->postJson('/api/admin/products', [
            'name' => 'Translated Bowl',
            'product_type_id' => $this->productType->id,
            'sku' => 'TRANS-001',
            'base_price' => '1.250',
        ])->assertCreated();

        $name = Product::query()->findOrFail($response->json('data.id'))->attribute_data->get('name');

        $this->assertInstanceOf(TranslatedText::class, $name);
        $this->assertSame('Translated Bowl', $name->getValue()->get('en')->getValue());
        $this->assertSame('Translated Bowl', $name->getValue()->get('vi')->getValue());
    }

    public function test_index_supports_search_filters_and_pagination_with_stock_and_lowest_price(): void
    {
        $this->actingAsAdmin();
        $brandA = Brand::query()->create(['name' => 'Alpha']);
        $brandB = Brand::query()->create(['name' => 'Beta']);

        $matching = $this->product('Orthopedic Bowl', 'published', $brandA->id);
        $this->variant($matching, 'ORTHO-L', 15500, 4);
        $this->variant($matching, 'ORTHO-S', 12500, 6);
        $other = $this->product('Travel Mat', 'draft', $brandB->id);
        $this->variant($other, 'MAT-001', 9900, 3);

        $this->getJson('/api/admin/products?search=ORTHO-S&status=published&brand_id='.$brandA->id.'&product_type_id='.$this->productType->id.'&per_page=1')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $matching->id)
            ->assertJsonPath('data.0.total_stock', 10)
            ->assertJsonPath('data.0.price.amount', 12500)
            ->assertJsonPath('meta.per_page', 1)
            ->assertJsonPath('meta.total', 1);

        $this->getJson('/api/admin/products?search=travel')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $other->id);
    }

    public function test_product_update_preserves_unsubmitted_attributes_and_syncs_ordered_collections_and_media(): void
    {
        $this->actingAsAdmin();
        $brand = Brand::query()->create(['name' => 'Posture Co']);
        $product = $this->product('Old Name', 'draft', null, [
            'description' => new Text('Keep this description'),
            'care' => new TranslatedText(['en' => 'Old EN', 'vi' => 'Old VI']),
            'legacy' => new Text('Keep legacy'),
        ]);
        $this->variant($product, 'MEDIA-001', 5000);
        [$first, $second] = $this->collections();
        [$curatorA, $curatorB] = $this->curatorMedia();

        $updateResponse = $this->putJson("/api/admin/products/{$product->id}", [
            'status' => 'published',
            'brand_id' => $brand->id,
            'attributes' => [
                'name' => 'New Name',
                'care' => ['en' => 'Hand wash', 'vi' => 'Rửa tay'],
            ],
            'collections' => [$second->id, $first->id],
            'media' => [
                ['source' => 'curator', 'id' => $curatorB->id],
                ['source' => 'curator', 'id' => $curatorA->id],
            ],
        ])->assertOk()
            ->assertJsonPath('data.status', 'published')
            ->assertJsonPath('data.brand_id', $brand->id)
            ->assertJsonPath('data.collection_ids', [$second->id, $first->id])
            ->assertJsonPath('data.media.0.id', (string) $curatorB->id)
            ->assertJsonPath('data.media.1.id', (string) $curatorA->id);

        $product->refresh();
        $this->assertSame('New Name', $product->attribute_data->get('name')->getValue());
        $this->assertSame('Keep this description', $product->attribute_data->get('description')->getValue());
        $this->assertSame('Keep legacy', $product->attribute_data->get('legacy')->getValue());
        $this->assertSame('Hand wash', $product->attribute_data->get('care')->getValue()->get('en')->getValue());
        $this->assertSame('Rửa tay', $product->attribute_data->get('care')->getValue()->get('vi')->getValue());
        $this->assertSame(
            [$second->id => 1, $first->id => 2],
            $product->collections()->get()->mapWithKeys(fn (Collection $collection) => [
                $collection->id => (int) $collection->pivot->position,
            ])->all()
        );

        $media = $product->images()->orderBy('order_column')->get();
        $this->assertCount(2, $media);
        $this->assertSame($curatorB->id, (int) $media[0]->getCustomProperty('curator_media_id'));
        $this->assertTrue((bool) $media[0]->getCustomProperty('primary'));
        $this->assertSame($curatorA->id, (int) $media[1]->getCustomProperty('curator_media_id'));
        $this->assertFalse((bool) $media[1]->getCustomProperty('primary'));

        $roundTripMedia = $updateResponse->json('data.media');
        $this->putJson("/api/admin/products/{$product->id}", [
            'status' => 'published',
            'brand_id' => $brand->id,
            'attributes' => ['name' => 'New Name'],
            'media' => $roundTripMedia,
        ])->assertOk()
            ->assertJsonPath('data.media', $roundTripMedia);
        $this->assertSame(2, $product->fresh()->images()->count());

        $this->putJson("/api/admin/products/{$product->id}", [
            'status' => 'published',
            'brand_id' => $brand->id,
            'attributes' => ['name' => 'New Name'],
            'media' => [
                ['source' => 'spatie', 'id' => $media[1]->id],
            ],
        ])->assertOk();

        $remaining = $product->fresh()->images()->get();
        $this->assertCount(1, $remaining);
        $this->assertSame($media[1]->id, $remaining->first()->id);
        $this->assertTrue((bool) $remaining->first()->getCustomProperty('primary'));
    }

    public function test_product_slug_is_returned_validated_unique_and_updates_the_existing_default_url(): void
    {
        $this->actingAsAdmin();
        $language = Language::getDefault();
        $product = $this->product('Slug product');
        $product->urls()->delete();
        $url = $product->urls()->create([
            'language_id' => $language->id,
            'slug' => 'old-product-slug',
            'default' => true,
        ]);
        $other = $this->product('Other product');
        $other->urls()->delete();
        $other->urls()->create([
            'language_id' => $language->id,
            'slug' => 'already-used',
            'default' => true,
        ]);

        $this->getJson("/api/admin/products/{$product->id}")
            ->assertOk()
            ->assertJsonPath('data.slug', 'old-product-slug');

        $payload = [
            'status' => 'published',
            'brand_id' => null,
            'attributes' => ['name' => 'Slug product'],
        ];
        $this->putJson("/api/admin/products/{$product->id}", $payload + ['slug' => 'Uppercase-Slug'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('slug');
        $this->putJson("/api/admin/products/{$product->id}", $payload + ['slug' => 'already-used'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('slug');

        $this->putJson("/api/admin/products/{$product->id}", $payload + ['slug' => 'new-product-slug'])
            ->assertOk()
            ->assertJsonPath('data.slug', 'new-product-slug');

        $url->refresh();
        $this->assertSame('new-product-slug', $url->slug);
        $this->assertSame($language->id, $url->language_id);
        $this->assertTrue($url->default);
        $this->assertSame(1, $product->urls()->count());
    }

    public function test_product_update_creates_a_default_url_when_one_is_missing(): void
    {
        $this->actingAsAdmin();
        $language = Language::getDefault();
        $product = $this->product('Missing URL');
        $product->urls()->delete();

        $this->putJson("/api/admin/products/{$product->id}", [
            'slug' => 'created-product-url',
            'status' => 'draft',
            'brand_id' => null,
            'attributes' => ['name' => 'Missing URL'],
        ])->assertOk()
            ->assertJsonPath('data.slug', 'created-product-url');

        $url = $product->urls()->sole();
        $this->assertSame($language->id, $url->language_id);
        $this->assertSame('created-product-url', $url->slug);
        $this->assertTrue($url->default);
    }

    public function test_direct_variant_update_isolated_from_siblings_options_pivots_and_non_base_prices(): void
    {
        $this->actingAsAdmin();
        $product = $this->product('Variant product');
        $target = $this->variant($product, 'VAR-RED', 10000, 5, [
            'variant_note' => new TranslatedText(['en' => 'Old note', 'vi' => 'Ghi chú cũ']),
        ]);
        $sibling = $this->variant($product, 'VAR-BLUE', 11000, 8);

        $option = ProductOption::query()->create([
            'name' => ['en' => 'Color'],
            'label' => ['en' => 'Color'],
            'handle' => 'color',
            'shared' => true,
        ]);
        $red = ProductOptionValue::query()->create([
            'product_option_id' => $option->id,
            'name' => ['en' => 'Red'],
            'position' => 1,
        ]);
        $blue = ProductOptionValue::query()->create([
            'product_option_id' => $option->id,
            'name' => ['en' => 'Blue'],
            'position' => 2,
        ]);
        $product->productOptions()->attach($option->id, ['position' => 1]);
        $target->values()->attach($red->id);
        $sibling->values()->attach($blue->id);

        $customerGroup = CustomerGroup::query()->create([
            'name' => 'Wholesale',
            'handle' => 'wholesale',
            'default' => false,
        ]);
        $otherCurrency = Currency::query()->create([
            'code' => 'JPY',
            'name' => 'Japanese Yen',
            'exchange_rate' => 1,
            'decimal_places' => 0,
            'enabled' => true,
            'default' => false,
            'sync_prices' => false,
        ]);
        $tierPrice = $target->prices()->create([
            'currency_id' => $this->currency->id,
            'customer_group_id' => null,
            'min_quantity' => 5,
            'price' => 9000,
        ]);
        $groupPrice = $target->prices()->create([
            'currency_id' => $this->currency->id,
            'customer_group_id' => $customerGroup->id,
            'min_quantity' => 1,
            'price' => 8000,
        ]);
        $foreignPrice = $target->prices()->create([
            'currency_id' => $otherCurrency->id,
            'customer_group_id' => null,
            'min_quantity' => 1,
            'price' => 700,
        ]);

        $siblingBefore = (array) DB::table('lunar_product_variants')->where('id', $sibling->id)->first();
        $optionsBefore = DB::table('lunar_product_options')->orderBy('id')->get()->map(fn ($row) => (array) $row)->all();
        $valuesBefore = DB::table('lunar_product_option_values')->orderBy('id')->get()->map(fn ($row) => (array) $row)->all();
        $productOptionsBefore = DB::table('lunar_product_product_option')->orderBy('id')->get()->map(fn ($row) => (array) $row)->all();
        $variantValuesBefore = DB::table('lunar_product_option_value_product_variant')->orderBy('variant_id')->orderBy('value_id')->get()->map(fn ($row) => (array) $row)->all();

        $this->putJson("/api/admin/products/{$product->id}/variants/{$target->id}", [
            'sku' => 'VAR-RED-UPDATED',
            'gtin' => '1234567890123',
            'mpn' => 'MPN-UPDATED',
            'ean' => '9876543210123',
            'stock' => 21,
            'backorder' => 2,
            'purchasable' => 'in_stock_or_on_backorder',
            'unit_quantity' => 2,
            'quantity_increment' => 2,
            'min_quantity' => 2,
            'tax_class_id' => $this->taxClass->id,
            'tax_ref' => 'TAX-REF',
            'shippable' => false,
            'length_value' => 10.5,
            'length_unit' => 'cm',
            'width_value' => 8,
            'width_unit' => 'cm',
            'height_value' => 4,
            'height_unit' => 'cm',
            'weight_value' => 1.2,
            'weight_unit' => 'kg',
            'base_price' => '15.750',
            'attributes' => [
                'variant_note' => ['en' => 'New note', 'vi' => 'Ghi chú mới'],
            ],
        ])->assertOk()
            ->assertJsonPath('data.sku', 'VAR-RED-UPDATED')
            ->assertJsonPath('data.stock', 21)
            ->assertJsonPath('data.base_price', '15.750')
            ->assertJsonPath('data.option_values.0.option_id', $option->id)
            ->assertJsonPath('data.option_values.0.value_id', $red->id);

        $target->refresh();
        $this->assertSame('VAR-RED-UPDATED', $target->sku);
        $this->assertSame(21, $target->stock);
        $this->assertSame('New note', $target->attribute_data->get('variant_note')->getValue()->get('en')->getValue());
        $this->assertSame(15750, (int) $target->prices()
            ->where('currency_id', $this->currency->id)
            ->whereNull('customer_group_id')
            ->where('min_quantity', 1)
            ->sole()
            ->getRawOriginal('price'));

        $this->assertSame($siblingBefore, (array) DB::table('lunar_product_variants')->where('id', $sibling->id)->first());
        $this->assertSame($optionsBefore, DB::table('lunar_product_options')->orderBy('id')->get()->map(fn ($row) => (array) $row)->all());
        $this->assertSame($valuesBefore, DB::table('lunar_product_option_values')->orderBy('id')->get()->map(fn ($row) => (array) $row)->all());
        $this->assertSame($productOptionsBefore, DB::table('lunar_product_product_option')->orderBy('id')->get()->map(fn ($row) => (array) $row)->all());
        $this->assertSame($variantValuesBefore, DB::table('lunar_product_option_value_product_variant')->orderBy('variant_id')->orderBy('value_id')->get()->map(fn ($row) => (array) $row)->all());
        $this->assertSame(9000, (int) $tierPrice->fresh()->getRawOriginal('price'));
        $this->assertSame(8000, (int) $groupPrice->fresh()->getRawOriginal('price'));
        $this->assertSame(700, (int) $foreignPrice->fresh()->getRawOriginal('price'));
        $this->assertSame(2, ProductVariant::query()->where('product_id', $product->id)->count());
    }

    public function test_variant_update_rejects_variant_owned_by_another_product(): void
    {
        $this->actingAsAdmin();
        $product = $this->product('First');
        $other = $this->product('Second');
        $variant = $this->variant($other, 'OTHER-001', 1000);

        $this->putJson("/api/admin/products/{$product->id}/variants/{$variant->id}", $this->variantPayload('OTHER-UPDATED'))
            ->assertNotFound();

        $this->assertSame('OTHER-001', $variant->fresh()->sku);
    }

    public function test_dynamic_attribute_money_and_duplicate_media_validation_is_safe(): void
    {
        $this->actingAsAdmin();

        $this->postJson('/api/admin/products', [
            'name' => 'Too precise',
            'product_type_id' => $this->productType->id,
            'sku' => 'PRICE-PRECISION',
            'base_price' => '1.2345',
        ])->assertUnprocessable()->assertJsonValidationErrors('base_price');

        $product = Product::query()->create([
            'product_type_id' => $this->productType->id,
            'status' => 'draft',
            'attribute_data' => ['description' => new Text('No required name')],
        ]);
        $this->variant($product, 'VALIDATION-001', 1000);
        [$curator] = $this->curatorMedia();

        $this->putJson("/api/admin/products/{$product->id}", [
            'status' => 'published',
            'brand_id' => null,
            'attributes' => [
                'name' => 'Valid name',
                'description' => ['not' => 'text'],
            ],
        ])->assertUnprocessable()->assertJsonValidationErrors('attributes.description');

        $this->putJson("/api/admin/products/{$product->id}", [
            'status' => 'published',
            'brand_id' => null,
            'attributes' => ['name' => 'Valid name'],
            'media' => [
                ['source' => 'curator', 'id' => $curator->id],
                ['source' => 'curator', 'id' => $curator->id],
            ],
        ])->assertUnprocessable()->assertJsonValidationErrors('media');

        $this->putJson("/api/admin/products/{$product->id}", [
            'status' => 'published',
            'brand_id' => null,
            'attributes' => ['description' => 'Valid description'],
        ])->assertUnprocessable()->assertJsonValidationErrors('attributes.name');
    }

    public function test_admin_can_soft_delete_product(): void
    {
        $this->actingAsAdmin();
        $product = $this->product('Delete me');
        $this->variant($product, 'DELETE-001', 1000);

        $this->deleteJson("/api/admin/products/{$product->id}")->assertNoContent();

        $this->assertSoftDeleted('lunar_products', ['id' => $product->id]);
        $this->getJson("/api/admin/products/{$product->id}")->assertNotFound();
    }

    private function actingAsAdmin(): User
    {
        $admin = User::factory()->create();
        $admin->assignRole('admin');
        Sanctum::actingAs($admin);

        return $admin;
    }

    private function attribute(
        AttributeGroup $group,
        string $target,
        string $handle,
        string $type,
        bool $required,
        bool $system,
        int $position
    ): Attribute {
        return Attribute::query()->create([
            'attribute_type' => $target,
            'attribute_group_id' => $group->id,
            'position' => $position,
            'name' => ['en' => ucfirst(str_replace('_', ' ', $handle))],
            'description' => ['en' => ''],
            'handle' => $handle,
            'section' => 'main',
            'type' => $type,
            'required' => $required,
            'default_value' => null,
            'configuration' => [],
            'system' => $system,
            'validation_rules' => null,
            'filterable' => false,
            'searchable' => $handle === 'name',
        ]);
    }

    private function product(
        string $name,
        string $status = 'published',
        ?int $brandId = null,
        array $extraAttributes = []
    ): Product {
        return Product::query()->create([
            'product_type_id' => $this->productType->id,
            'status' => $status,
            'brand_id' => $brandId,
            'attribute_data' => array_merge([
                'name' => new Text($name),
            ], $extraAttributes),
        ]);
    }

    private function variant(
        Product $product,
        string $sku,
        int $price,
        int $stock = 0,
        array $attributes = []
    ): ProductVariant {
        $variant = $product->variants()->create([
            'tax_class_id' => $this->taxClass->id,
            'sku' => $sku,
            'stock' => $stock,
            'backorder' => 0,
            'purchasable' => 'always',
            'unit_quantity' => 1,
            'min_quantity' => 1,
            'quantity_increment' => 1,
            'shippable' => true,
            'attribute_data' => $attributes,
        ]);
        $variant->prices()->create([
            'currency_id' => $this->currency->id,
            'customer_group_id' => null,
            'min_quantity' => 1,
            'price' => $price,
        ]);

        return $variant;
    }

    private function collections(): array
    {
        $group = CollectionGroup::query()->create([
            'name' => 'Categories',
            'handle' => 'categories',
        ]);

        $first = new Collection([
            'collection_group_id' => $group->id,
            'attribute_data' => ['name' => new Text('First')],
        ]);
        $first->saveAsRoot();
        $second = new Collection([
            'collection_group_id' => $group->id,
            'attribute_data' => ['name' => new Text('Second')],
        ]);
        $second->saveAsRoot();

        return [$first, $second];
    }

    private function curatorMedia(): array
    {
        $records = [];

        foreach (['first.jpg', 'second.jpg'] as $index => $name) {
            $path = 'media/'.$name;
            $file = UploadedFile::fake()->image($name, 20, 20);
            Storage::disk('public')->put($path, $file->getContent());
            $records[] = CuratorMedia::query()->create([
                'disk' => 'public',
                'directory' => 'media',
                'visibility' => 'public',
                'name' => $name,
                'path' => $path,
                'width' => 20,
                'height' => 20,
                'size' => Storage::disk('public')->size($path),
                'type' => 'image',
                'ext' => 'jpg',
                'alt' => 'Image '.($index + 1),
            ]);
        }

        return $records;
    }

    private function variantPayload(string $sku): array
    {
        return [
            'sku' => $sku,
            'gtin' => null,
            'mpn' => null,
            'ean' => null,
            'stock' => 1,
            'backorder' => 0,
            'purchasable' => 'always',
            'unit_quantity' => 1,
            'quantity_increment' => 1,
            'min_quantity' => 1,
            'tax_class_id' => $this->taxClass->id,
            'tax_ref' => null,
            'shippable' => true,
            'length_value' => null,
            'length_unit' => null,
            'width_value' => null,
            'width_unit' => null,
            'height_value' => null,
            'height_unit' => null,
            'weight_value' => null,
            'weight_unit' => null,
            'base_price' => '1.000',
            'attributes' => [
                'variant_note' => ['en' => '', 'vi' => ''],
            ],
        ];
    }
}
