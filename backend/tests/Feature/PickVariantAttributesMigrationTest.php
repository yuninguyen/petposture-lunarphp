<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Lunar\FieldTypes\Text;
use Lunar\Models\Attribute;
use Lunar\Models\AttributeGroup;
use Lunar\Models\ProductType;
use Lunar\Models\ProductVariant;
use Tests\TestCase;

class PickVariantAttributesMigrationTest extends TestCase
{
    use RefreshDatabase;

    private function migration(): object
    {
        return require base_path('database/migrations/2026_11_18_000002_add_pick_variant_attributes.php');
    }

    public function test_it_creates_the_two_optional_variant_attributes_and_maps_them_to_every_type_safely_twice(): void
    {
        $first = ProductType::query()->create(['name' => 'General']);
        $second = ProductType::query()->create(['name' => 'Harnesses']);

        $this->migration()->up();
        $this->migration()->up();

        $attributes = Attribute::query()->where('attribute_type', ProductVariant::morphName())->whereIn('handle', ['external_url', 'reference_price'])->get();
        $this->assertCount(2, $attributes);
        foreach ($attributes as $attribute) {
            $this->assertFalse((bool) $attribute->required, "{$attribute->handle} must stay optional");
            $this->assertSame(Text::class, $attribute->type);
        }
        foreach ([$first, $second] as $type) {
            $this->assertSame(2, $type->variantAttributes()->whereIn('handle', ['external_url', 'reference_price'])->count());
        }
    }

    public function test_the_product_level_attributes_of_the_same_name_are_left_alone(): void
    {
        $group = AttributeGroup::query()->create(['attributable_type' => 'product', 'name' => ['en' => 'Details'], 'handle' => 'details', 'position' => 1]);
        $product = Attribute::query()->create([
            'attribute_type' => 'product', 'attribute_group_id' => $group->id, 'position' => 1, 'name' => ['en' => 'Retailer URL'], 'handle' => 'external_url',
            'section' => null, 'type' => Text::class, 'required' => false, 'default_value' => null, 'configuration' => ['richtext' => false],
            'system' => false, 'validation_rules' => null, 'filterable' => false, 'searchable' => false,
        ]);

        $this->migration()->up();

        $this->assertSame(2, Attribute::query()->where('handle', 'external_url')->count());
        $this->assertSame('product', $product->fresh()->attribute_type);
    }

    public function test_down_removes_only_the_variant_attributes(): void
    {
        ProductType::query()->create(['name' => 'General']);
        $this->migration()->up();

        $this->migration()->down();

        $this->assertSame(0, Attribute::query()->where('attribute_type', ProductVariant::morphName())->count());
    }
}
