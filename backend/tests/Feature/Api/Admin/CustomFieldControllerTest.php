<?php

namespace Tests\Feature\Api\Admin;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\Sanctum;
use Lunar\FieldTypes\Text;
use Lunar\Models\Attribute;
use Lunar\Models\AttributeGroup;
use Lunar\Models\Product;
use Lunar\Models\ProductType;
use Lunar\Models\ProductVariant;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class CustomFieldControllerTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        Role::firstOrCreate(['name' => 'admin', 'guard_name' => 'web']);
        Role::firstOrCreate(['name' => 'customer', 'guard_name' => 'web']);
    }

    public function test_custom_field_routes_require_an_authenticated_admin(): void
    {
        $this->getJson('/api/admin/custom-fields')->assertUnauthorized();

        $customer = User::factory()->create();
        $customer->assignRole('customer');
        Sanctum::actingAs($customer);

        $this->getJson('/api/admin/custom-fields')->assertForbidden();
    }

    public function test_list_returns_only_manageable_text_fields_with_mappings(): void
    {
        $this->actingAsAdmin();
        $type = ProductType::factory()->create(['name' => 'Harnesses']);
        $manageable = $this->makeAttribute('Sizing Notes', 'sizing_notes', 'product', ['section' => null]);
        $type->mappedAttributes()->attach($manageable->id);
        $this->makeAttribute('Core Name', 'core_name', 'product', ['section' => 'main']);
        $this->makeAttribute('System Field', 'system_field', 'product', ['system' => true]);
        $this->makeAttribute('Unsupported', 'unsupported', 'product', ['type' => 'Unsupported\\FieldType']);

        $response = $this->getJson('/api/admin/custom-fields')->assertOk();

        $this->assertCount(1, $response->json('data'));
        $response->assertJsonPath('data.0.id', $manageable->id)
            ->assertJsonPath('data.0.name.en', 'Sizing Notes')
            ->assertJsonPath('data.0.display_name', 'Sizing Notes')
            ->assertJsonPath('data.0.target', 'product')
            ->assertJsonPath('data.0.field_type', 'text')
            ->assertJsonPath('data.0.product_type_ids.0', $type->id)
            ->assertJsonPath('data.0.product_types.0.name', 'Harnesses');
    }

    public function test_admin_can_create_product_and_variant_fields_with_dedicated_groups(): void
    {
        $this->actingAsAdmin();
        $type = ProductType::factory()->create();

        $product = $this->postJson('/api/admin/custom-fields', $this->payload($type, [
            'name' => ['en' => 'Care Instructions'],
            'handle' => 'care_text',
            'target' => 'product',
        ]))->assertCreated();

        $variant = $this->postJson('/api/admin/custom-fields', $this->payload($type, [
            'name' => ['en' => 'Variant Label', 'vi' => 'Nhãn biến thể'],
            'target' => 'variant',
        ]))->assertCreated();

        $product->assertJsonPath('data.handle', 'care_text')
            ->assertJsonPath('data.target', 'product');
        $variant->assertJsonPath('data.handle', 'variant_label')
            ->assertJsonPath('data.target', 'variant')
            ->assertJsonPath('data.name.vi', 'Nhãn biến thể');

        $this->assertDatabaseHas('lunar_attribute_groups', [
            'handle' => 'custom_fields_product',
            'attributable_type' => 'product',
        ]);
        $this->assertDatabaseHas('lunar_attribute_groups', [
            'handle' => 'custom_fields_variant',
            'attributable_type' => 'product_variant',
        ]);
        $this->assertDatabaseHas('lunar_attributes', [
            'id' => $product->json('data.id'),
            'section' => 'custom',
            'type' => Text::class,
            'system' => false,
            'filterable' => false,
            'searchable' => false,
        ]);
        $this->assertSame(2, AttributeGroup::query()->whereIn('handle', [
            'custom_fields_product',
            'custom_fields_variant',
        ])->count());
    }

    public function test_create_requires_distinct_existing_product_type_ids_and_unique_handle_per_target(): void
    {
        $this->actingAsAdmin();
        $type = ProductType::factory()->create();

        $this->postJson('/api/admin/custom-fields', $this->payload($type, [
            'product_type_ids' => [$type->id, $type->id, 999999],
        ]))->assertUnprocessable()->assertJsonValidationErrors(['product_type_ids.1', 'product_type_ids.2']);

        $this->postJson('/api/admin/custom-fields', $this->payload($type, [
            'handle' => 'Invalid Handle',
        ]))->assertUnprocessable()->assertJsonValidationErrors(['handle']);

        $this->postJson('/api/admin/custom-fields', $this->payload($type))->assertCreated();
        $this->postJson('/api/admin/custom-fields', $this->payload($type))->assertUnprocessable()
            ->assertJsonValidationErrors(['handle']);

        $this->postJson('/api/admin/custom-fields', $this->payload($type, ['target' => 'variant']))
            ->assertCreated();
    }

    public function test_update_merges_locales_and_rejects_immutable_fields(): void
    {
        $this->actingAsAdmin();
        $type = ProductType::factory()->create();
        $attributeId = $this->createField($type, [
            'name' => ['en' => 'Label', 'vi' => 'Nhãn'],
        ]);

        $this->putJson("/api/admin/custom-fields/{$attributeId}", [
            'name' => ['en' => 'New Label'],
            'required' => true,
            'product_type_ids' => [$type->id],
        ])->assertOk()
            ->assertJsonPath('data.name.en', 'New Label')
            ->assertJsonPath('data.name.vi', 'Nhãn')
            ->assertJsonPath('data.required', true);

        $this->putJson("/api/admin/custom-fields/{$attributeId}", [
            'name' => ['en' => 'Ignored'],
            'handle' => 'changed',
            'target' => 'variant',
            'field_type' => 'other',
            'required' => false,
            'product_type_ids' => [$type->id],
        ])->assertUnprocessable()->assertJsonValidationErrors(['handle', 'target', 'field_type']);

        $attribute = Attribute::query()->findOrFail($attributeId);
        $this->assertSame('label', $attribute->handle);
        $this->assertSame('product', $attribute->attribute_type);
        $this->assertSame(Text::class, $attribute->type);
    }

    public function test_mapping_diff_preserves_other_attributes_and_allows_unmap_without_values(): void
    {
        $this->actingAsAdmin();
        $first = ProductType::factory()->create();
        $second = ProductType::factory()->create();
        $third = ProductType::factory()->create();
        $attributeId = $this->createField($first);
        $other = $this->makeAttribute('Other', 'other');
        $first->mappedAttributes()->attach($other->id);
        $second->mappedAttributes()->attach($other->id);

        $this->putJson("/api/admin/custom-fields/{$attributeId}", [
            'name' => ['en' => 'Updated'],
            'required' => false,
            'product_type_ids' => [$second->id, $third->id],
        ])->assertOk();

        $this->assertFalse($first->mappedAttributes()->whereKey($attributeId)->exists());
        $this->assertTrue($second->mappedAttributes()->whereKey($attributeId)->exists());
        $this->assertTrue($third->mappedAttributes()->whereKey($attributeId)->exists());
        $this->assertTrue($first->mappedAttributes()->whereKey($other->id)->exists());
        $this->assertTrue($second->mappedAttributes()->whereKey($other->id)->exists());
    }

    public function test_product_unmap_is_blocked_for_non_null_and_empty_string_and_mapping_is_unchanged(): void
    {
        $this->actingAsAdmin();
        $type = ProductType::factory()->create();
        $keep = ProductType::factory()->create();
        $added = ProductType::factory()->create();
        $attributeId = $this->createField($type);
        $keep->mappedAttributes()->attach($attributeId);
        $product = Product::factory()->create(['product_type_id' => $type->id]);

        foreach (['used', ''] as $value) {
            $this->setRawAttributeData('lunar_products', $product->id, 'label', $value);

            $this->putJson("/api/admin/custom-fields/{$attributeId}", [
                'name' => ['en' => 'Attempted Change'],
                'required' => true,
                'product_type_ids' => [$keep->id, $added->id],
            ])->assertStatus(409)
                ->assertJsonPath('code', 'CUSTOM_FIELD_IN_USE')
                ->assertJsonPath('details.attribute_id', $attributeId)
                ->assertJsonPath('details.product_type_id', $type->id)
                ->assertJsonPath('details.target', 'product');

            $this->assertTrue($type->mappedAttributes()->whereKey($attributeId)->exists());
            $this->assertTrue($keep->mappedAttributes()->whereKey($attributeId)->exists());
            $this->assertFalse($added->mappedAttributes()->whereKey($attributeId)->exists());
            $this->assertSame('Label', Attribute::query()->findOrFail($attributeId)->name['en']);
        }
    }

    public function test_null_product_value_allows_unmap_without_changing_attribute_data(): void
    {
        $this->actingAsAdmin();
        $type = ProductType::factory()->create();
        $keep = ProductType::factory()->create();
        $attributeId = $this->createField($type);
        $keep->mappedAttributes()->attach($attributeId);
        $product = Product::factory()->create(['product_type_id' => $type->id]);
        $this->setRawAttributeData('lunar_products', $product->id, 'label', null);
        $before = DB::table('lunar_products')->where('id', $product->id)->value('attribute_data');

        $this->putJson("/api/admin/custom-fields/{$attributeId}", [
            'name' => ['en' => 'Updated'],
            'required' => false,
            'product_type_ids' => [$keep->id],
        ])->assertOk();

        $this->assertFalse($type->mappedAttributes()->whereKey($attributeId)->exists());
        $this->assertSame($before, DB::table('lunar_products')->where('id', $product->id)->value('attribute_data'));
    }

    public function test_variant_unmap_guard_scans_variants_belonging_to_products_of_the_type(): void
    {
        $this->actingAsAdmin();
        $type = ProductType::factory()->create();
        $keep = ProductType::factory()->create();
        $attributeId = $this->createField($type, ['target' => 'variant']);
        $keep->mappedAttributes()->attach($attributeId);
        $product = Product::factory()->create(['product_type_id' => $type->id]);
        $variant = ProductVariant::factory()->create(['product_id' => $product->id]);
        $this->setRawAttributeData('lunar_product_variants', $variant->id, 'label', 'variant value');
        $before = DB::table('lunar_product_variants')->where('id', $variant->id)->value('attribute_data');

        $this->putJson("/api/admin/custom-fields/{$attributeId}", [
            'name' => ['en' => 'Updated'],
            'required' => false,
            'product_type_ids' => [$keep->id],
        ])->assertStatus(409)->assertJsonPath('details.target', 'variant');

        $this->assertTrue($type->mappedAttributes()->whereKey($attributeId)->exists());
        $this->assertSame($before, DB::table('lunar_product_variants')->where('id', $variant->id)->value('attribute_data'));
    }

    public function test_delete_is_blocked_when_used_and_allowed_for_null_without_cleaning_attribute_data(): void
    {
        $this->actingAsAdmin();
        $blockedType = ProductType::factory()->create();
        $blockedId = $this->createField($blockedType);
        $blockedProduct = Product::factory()->create(['product_type_id' => $blockedType->id]);
        $this->setRawAttributeData('lunar_products', $blockedProduct->id, 'label', 'used');

        $this->deleteJson("/api/admin/custom-fields/{$blockedId}")
            ->assertStatus(409)
            ->assertJsonPath('code', 'CUSTOM_FIELD_IN_USE');
        $this->assertDatabaseHas('lunar_attributes', ['id' => $blockedId]);
        $this->assertTrue($blockedType->mappedAttributes()->whereKey($blockedId)->exists());

        $orphanType = ProductType::factory()->create();
        $orphanId = $this->createField($orphanType, ['name' => ['en' => 'Orphaned']]);
        $orphanType->mappedAttributes()->detach($orphanId);
        $orphanProduct = Product::factory()->create(['product_type_id' => $orphanType->id]);
        $this->setRawAttributeData('lunar_products', $orphanProduct->id, 'orphaned', 'still stored');

        $this->deleteJson("/api/admin/custom-fields/{$orphanId}")
            ->assertStatus(409)
            ->assertJsonPath('details.product_type_id', $orphanType->id);
        $this->assertDatabaseHas('lunar_attributes', ['id' => $orphanId]);

        $allowedType = ProductType::factory()->create();
        $allowedId = $this->createField($allowedType, ['name' => ['en' => 'Nullable']]);
        $allowedProduct = Product::factory()->create(['product_type_id' => $allowedType->id]);
        $this->setRawAttributeData('lunar_products', $allowedProduct->id, 'nullable', null);
        $before = DB::table('lunar_products')->where('id', $allowedProduct->id)->value('attribute_data');

        $this->deleteJson("/api/admin/custom-fields/{$allowedId}")->assertNoContent();

        $this->assertDatabaseMissing('lunar_attributes', ['id' => $allowedId]);
        $this->assertSame($before, DB::table('lunar_products')->where('id', $allowedProduct->id)->value('attribute_data'));
    }

    public function test_show_and_mutations_reject_unsupported_core_attributes(): void
    {
        $this->actingAsAdmin();
        $type = ProductType::factory()->create();
        $core = $this->makeAttribute('Name', 'name', 'product', ['section' => 'main']);

        $this->getJson("/api/admin/custom-fields/{$core->id}")->assertNotFound();
        $this->putJson("/api/admin/custom-fields/{$core->id}", [
            'name' => ['en' => 'Changed'],
            'required' => false,
            'product_type_ids' => [$type->id],
        ])->assertNotFound();
        $this->deleteJson("/api/admin/custom-fields/{$core->id}")->assertNotFound();
        $this->assertDatabaseHas('lunar_attributes', ['id' => $core->id, 'handle' => 'name']);
    }

    private function actingAsAdmin(): User
    {
        $admin = User::factory()->create();
        $admin->assignRole('admin');
        Sanctum::actingAs($admin);

        return $admin;
    }

    private function payload(ProductType $type, array $overrides = []): array
    {
        return array_replace_recursive([
            'name' => ['en' => 'Label'],
            'target' => 'product',
            'field_type' => 'text',
            'required' => false,
            'product_type_ids' => [$type->id],
        ], $overrides);
    }

    private function createField(ProductType $type, array $overrides = []): int
    {
        return (int) $this->postJson('/api/admin/custom-fields', $this->payload($type, $overrides))
            ->assertCreated()
            ->json('data.id');
    }

    private function makeAttribute(string $name, string $handle, string $target = 'product', array $overrides = []): Attribute
    {
        $groupHandle = 'test_group_'.$target;
        $group = AttributeGroup::query()->firstOrCreate(
            ['handle' => $groupHandle],
            [
                'attributable_type' => $target,
                'name' => ['en' => 'Test'],
                'position' => 1,
            ]
        );

        return Attribute::query()->create(array_merge([
            'attribute_type' => $target,
            'attribute_group_id' => $group->id,
            'position' => (int) Attribute::query()->where('attribute_type', $target)->max('position') + 1,
            'name' => ['en' => $name],
            'description' => null,
            'handle' => $handle,
            'section' => 'custom',
            'type' => Text::class,
            'required' => false,
            'default_value' => null,
            'configuration' => ['richtext' => false],
            'system' => false,
            'validation_rules' => null,
            'filterable' => false,
            'searchable' => false,
        ], $overrides));
    }

    private function setRawAttributeData(string $table, int $id, string $handle, mixed $value): void
    {
        DB::table($table)->where('id', $id)->update([
            'attribute_data' => json_encode([
                $handle => [
                    'field_type' => Text::class,
                    'value' => $value,
                ],
            ]),
        ]);
    }
}
