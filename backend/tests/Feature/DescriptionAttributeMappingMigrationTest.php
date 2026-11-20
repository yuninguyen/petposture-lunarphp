<?php

namespace Tests\Feature;

use App\Services\Admin\ProductAttributeService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Lunar\FieldTypes\Text;
use Lunar\Models\Attribute;
use Lunar\Models\AttributeGroup;
use Lunar\Models\ProductType;
use Tests\TestCase;

class DescriptionAttributeMappingMigrationTest extends TestCase
{
    use RefreshDatabase;

    private function migration(): object
    {
        return require base_path('database/migrations/2026_11_20_000002_map_description_attribute_to_every_product_type.php');
    }

    private function descriptionAttribute(): Attribute
    {
        $group = AttributeGroup::query()->create([
            'attributable_type' => 'product', 'name' => ['en' => 'Details'], 'handle' => 'details', 'position' => 1,
        ]);

        return Attribute::query()->create([
            'attribute_type' => 'product', 'attribute_group_id' => $group->id, 'position' => 2, 'name' => ['en' => 'Description'],
            'handle' => 'description', 'section' => null, 'type' => Text::class, 'required' => false, 'default_value' => null,
            'configuration' => ['richtext' => true], 'system' => false, 'validation_rules' => null, 'filterable' => false, 'searchable' => false,
        ]);
    }

    private function handles(ProductType $type): array
    {
        return collect(app(ProductAttributeService::class)->definitions($type->fresh(), 'product'))->pluck('handle')->all();
    }

    public function test_a_type_without_the_description_attribute_gets_the_description_field_in_the_product_form(): void
    {
        $description = $this->descriptionAttribute();
        $general = ProductType::query()->create(['name' => 'General']);
        $harnesses = ProductType::query()->create(['name' => 'Harnesses']);
        $harnesses->mappedAttributes()->attach($description->id);

        $this->assertNotContains('description', $this->handles($general));

        $this->migration()->up();
        $this->migration()->up();

        $this->assertContains('description', $this->handles($general));
        $this->assertSame(1, $harnesses->mappedAttributes()->where('handle', 'description')->count());
        $this->assertSame(1, $general->mappedAttributes()->where('handle', 'description')->count());
    }

    public function test_a_description_can_then_be_saved_on_a_product_of_that_type(): void
    {
        $this->descriptionAttribute();
        $general = ProductType::query()->create(['name' => 'General']);
        $service = app(ProductAttributeService::class);

        $this->migration()->up();

        $saved = $service->apply($general->fresh(), 'product', collect(), ['description' => '<p>A raised, tilted bowl.</p>']);

        $this->assertSame('<p>A raised, tilted bowl.</p>', $saved->get('description')->getValue());
    }

    public function test_it_does_nothing_when_there_is_no_description_attribute(): void
    {
        ProductType::query()->create(['name' => 'General']);
        $before = ProductType::query()->first()->mappedAttributes()->pluck('handle')->all();

        $this->migration()->up();

        // Other migrations map their own attributes to the seeded type; this one adds nothing when `description` is absent.
        $this->assertSame($before, ProductType::query()->first()->mappedAttributes()->pluck('handle')->all());
        $this->assertNotContains('description', $before);
    }
}
