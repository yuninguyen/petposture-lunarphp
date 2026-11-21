<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Lunar\FieldTypes\Text;
use Lunar\Models\Attribute;
use Lunar\Models\AttributeGroup;
use Lunar\Models\ProductType;
use Tests\TestCase;

class SecondRetailerPriceAttributesMigrationTest extends TestCase
{
    use RefreshDatabase;

    private const HANDLES = ['second_retailer_price', 'second_retailer_price_checked_date'];

    private function migration(): object
    {
        return require base_path('database/migrations/2026_11_21_000002_add_second_retailer_price_attributes.php');
    }

    private function productGroup(): AttributeGroup
    {
        return AttributeGroup::query()->firstOrCreate(
            ['attributable_type' => 'product', 'handle' => 'details'],
            ['name' => ['en' => 'Details'], 'position' => 1],
        );
    }

    private function mapped(ProductType $type): array
    {
        return $type->mappedAttributes()->whereIn('handle', self::HANDLES)->pluck('handle')->sort()->values()->all();
    }

    public function test_it_adds_two_optional_text_fields_and_maps_them_to_every_product_type_once(): void
    {
        $this->productGroup();
        $general = ProductType::query()->create(['name' => 'General']);
        $harnesses = ProductType::query()->create(['name' => 'Harnesses']);

        $this->migration()->up();
        $this->migration()->up();

        foreach (self::HANDLES as $handle) {
            $attribute = Attribute::query()->where('attribute_type', 'product')->where('handle', $handle)->sole();

            $this->assertSame(Text::class, $attribute->type);
            $this->assertFalse((bool) $attribute->required);
            $this->assertFalse((bool) $attribute->system);
        }
        $this->assertSame(self::HANDLES, $this->mapped($general));
        $this->assertSame(self::HANDLES, $this->mapped($harnesses));
        $this->assertSame(2, Attribute::query()->where('attribute_type', 'product')->whereIn('handle', self::HANDLES)->count());
    }

    public function test_it_does_nothing_when_there_is_no_product_attribute_group(): void
    {
        AttributeGroup::query()->where('attributable_type', 'product')->delete();

        $this->migration()->up();

        $this->assertSame(0, Attribute::query()->where('attribute_type', 'product')->whereIn('handle', self::HANDLES)->count());
    }

    public function test_down_unmaps_and_removes_them(): void
    {
        $this->productGroup();
        $general = ProductType::query()->create(['name' => 'General']);

        $this->migration()->up();
        $this->migration()->down();

        $this->assertSame([], $this->mapped($general));
        $this->assertSame(0, Attribute::query()->where('attribute_type', 'product')->whereIn('handle', self::HANDLES)->count());
    }
}
