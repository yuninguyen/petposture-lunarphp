<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Lunar\FieldTypes\Text;
use Lunar\Models\Attribute;
use Lunar\Models\AttributeGroup;
use Lunar\Models\ProductType;
use Tests\TestCase;

class PickStoryAttributesMigrationTest extends TestCase
{
    use RefreshDatabase;

    private const HANDLES = ['our_take', 'best_for_note', 'problem', 'approach', 'quick_specs'];

    private function migration(): object
    {
        return require base_path('database/migrations/2026_11_17_000001_add_pick_story_attributes.php');
    }

    private function productGroup(): AttributeGroup
    {
        return AttributeGroup::query()->create([
            'attributable_type' => 'product',
            'name' => ['en' => 'Product details'],
            'handle' => 'product_details',
            'position' => 1,
        ]);
    }

    public function test_it_creates_the_five_story_attributes_as_optional_plain_text(): void
    {
        $this->productGroup();

        $this->migration()->up();

        $attributes = Attribute::query()->where('attribute_type', 'product')->whereIn('handle', self::HANDLES)->get();
        $this->assertCount(count(self::HANDLES), $attributes);
        foreach ($attributes as $attribute) {
            $this->assertFalse((bool) $attribute->required, "{$attribute->handle} must not be required");
            $this->assertSame(Text::class, $attribute->type);
        }
    }

    public function test_it_maps_them_to_every_existing_product_type_and_is_safe_to_run_twice(): void
    {
        $this->productGroup();
        $first = ProductType::query()->create(['name' => 'Harnesses']);
        $second = ProductType::query()->create(['name' => 'Bowls']);

        $this->migration()->up();
        $this->migration()->up();

        foreach ([$first, $second] as $type) {
            $this->assertSame(count(self::HANDLES), $type->mappedAttributes()->whereIn('handle', self::HANDLES)->count());
        }
        $this->assertSame(
            count(self::HANDLES),
            Attribute::query()->where('attribute_type', 'product')->whereIn('handle', self::HANDLES)->count(),
        );
    }

    public function test_it_tells_the_editor_to_enter_only_sourced_facts(): void
    {
        $this->productGroup();

        $this->migration()->up();

        $quickSpecs = Attribute::query()->where('attribute_type', 'product')->where('handle', 'quick_specs')->firstOrFail();
        // The description is a translatable field, so read what is stored rather than casting the model value.
        $stored = (string) $quickSpecs->getRawOriginal('description');
        $this->assertStringContainsString('label: value', $stored);
        $this->assertStringContainsStringIgnoringCase('source', $stored);
    }

    public function test_down_removes_them(): void
    {
        $this->productGroup();
        ProductType::query()->create(['name' => 'Harnesses']);
        $this->migration()->up();

        $this->migration()->down();

        $this->assertFalse(Attribute::query()->where('attribute_type', 'product')->whereIn('handle', self::HANDLES)->exists());
    }
}
