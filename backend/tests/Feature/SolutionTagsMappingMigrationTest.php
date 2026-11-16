<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Lunar\FieldTypes\Text;
use Lunar\Models\Attribute;
use Lunar\Models\AttributeGroup;
use Lunar\Models\ProductType;
use Tests\TestCase;

class SolutionTagsMappingMigrationTest extends TestCase
{
    use RefreshDatabase;

    private function migration(): object
    {
        return require base_path('database/migrations/2026_11_18_000001_map_solution_tags_to_product_types.php');
    }

    /** The attribute already exists on production (an August migration made it) but was never mapped to a product type. */
    private function existingSolutionTags(string $description = 'Comma-separated solution slugs, e.g. "eating-digestion,comfort-safety"'): Attribute
    {
        $group = AttributeGroup::query()->create([
            'attributable_type' => 'product',
            'name' => ['en' => 'Product details'],
            'handle' => 'product_details',
            'position' => 1,
        ]);

        return Attribute::query()->create([
            'attribute_type' => 'product',
            'attribute_group_id' => $group->id,
            'position' => 1,
            'name' => ['en' => 'Solution Tags'],
            'description' => $description,
            'handle' => 'solution_tags',
            'section' => null,
            'type' => Text::class,
            'required' => false,
            'default_value' => null,
            'configuration' => ['richtext' => false],
            'system' => false,
            'validation_rules' => null,
            'filterable' => false,
            'searchable' => false,
        ]);
    }

    public function test_it_maps_the_existing_attribute_to_every_product_type_and_is_safe_to_run_twice(): void
    {
        $attribute = $this->existingSolutionTags();
        $general = ProductType::query()->create(['name' => 'General']);
        $harnesses = ProductType::query()->create(['name' => 'Harnesses']);

        $this->migration()->up();
        $this->migration()->up();

        foreach ([$general, $harnesses] as $type) {
            $this->assertSame(1, $type->mappedAttributes()->where('handle', 'solution_tags')->count());
        }
        $this->assertSame(1, Attribute::query()->where('attribute_type', 'product')->where('handle', 'solution_tags')->count());
        $this->assertSame($attribute->id, Attribute::query()->where('handle', 'solution_tags')->value('id'));
    }

    public function test_it_does_not_create_the_attribute_when_there_is_none_to_map(): void
    {
        ProductType::query()->create(['name' => 'General']);

        $this->migration()->up();

        $this->assertFalse(Attribute::query()->where('handle', 'solution_tags')->exists());
    }

    public function test_it_tells_the_editor_the_solution_slugs_of_the_site_not_the_old_ones(): void
    {
        $this->existingSolutionTags();
        ProductType::query()->create(['name' => 'General']);

        $this->migration()->up();

        // The description is a translatable field, so read what is stored rather than casting the model value.
        $stored = (string) Attribute::query()->where('handle', 'solution_tags')->firstOrFail()->getRawOriginal('description');
        foreach (['feeding', 'comfort', 'mobility', 'walking'] as $slug) {
            $this->assertStringContainsString($slug, $stored);
        }
        $this->assertStringNotContainsString('eating-digestion', $stored);
    }

    public function test_down_unmaps_it_but_keeps_the_attribute_and_the_tags_already_entered(): void
    {
        $this->existingSolutionTags();
        $type = ProductType::query()->create(['name' => 'General']);
        $this->migration()->up();

        $this->migration()->down();

        $this->assertSame(0, $type->mappedAttributes()->where('handle', 'solution_tags')->count());
        $this->assertTrue(Attribute::query()->where('handle', 'solution_tags')->exists());
    }
}
