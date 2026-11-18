<?php

namespace Tests\Feature;

use App\Services\Admin\ProductAttributeService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Lunar\FieldTypes\Text;
use Lunar\Models\Attribute;
use Lunar\Models\AttributeGroup;
use Lunar\Models\ProductType;
use Tests\TestCase;

class NameAttributeMappingMigrationTest extends TestCase
{
    use RefreshDatabase;

    private function migration(): object
    {
        return require base_path('database/migrations/2026_11_18_000001_map_name_attribute_to_every_product_type.php');
    }

    private function nameAttribute(): Attribute
    {
        $group = AttributeGroup::query()->create([
            'attributable_type' => 'product', 'name' => ['en' => 'Details'], 'handle' => 'details', 'position' => 1,
        ]);

        return Attribute::query()->create([
            'attribute_type' => 'product', 'attribute_group_id' => $group->id, 'position' => 1, 'name' => ['en' => 'Name'],
            'handle' => 'name', 'section' => null, 'type' => Text::class, 'required' => true, 'default_value' => null,
            'configuration' => ['richtext' => false], 'system' => true, 'validation_rules' => null, 'filterable' => false, 'searchable' => false,
        ]);
    }

    public function test_a_type_without_the_name_attribute_gets_the_title_field_in_the_product_form(): void
    {
        $name = $this->nameAttribute();
        $general = ProductType::query()->create(['name' => 'General']);
        $harnesses = ProductType::query()->create(['name' => 'Harnesses']);
        $harnesses->mappedAttributes()->attach($name->id);

        $this->assertNotContains('name', collect(app(ProductAttributeService::class)->definitions($general, 'product'))->pluck('handle')->all());

        $this->migration()->up();
        $this->migration()->up();

        $this->assertContains('name', collect(app(ProductAttributeService::class)->definitions($general->fresh(), 'product'))->pluck('handle')->all());
        $this->assertSame(1, $harnesses->mappedAttributes()->where('handle', 'name')->count());
    }

    public function test_it_does_nothing_when_there_is_no_name_attribute(): void
    {
        ProductType::query()->create(['name' => 'General']);

        $this->migration()->up();

        $this->assertSame(0, ProductType::query()->first()->mappedAttributes()->where('handle', 'name')->count());
    }
}
