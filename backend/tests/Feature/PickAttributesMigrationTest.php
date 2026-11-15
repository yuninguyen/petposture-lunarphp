<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Lunar\FieldTypes\Text;
use Lunar\Models\Attribute;
use Lunar\Models\AttributeGroup;
use Lunar\Models\ProductType;
use Tests\TestCase;

class PickAttributesMigrationTest extends TestCase
{
    use RefreshDatabase;

    private const HANDLES = [
        'external_url',
        'affiliate_network_slug',
        'reference_price',
        'price_checked_date',
        'best_for_breeds',
        'pros',
        'cons',
    ];

    private function migration(): object
    {
        return require base_path('database/migrations/2026_11_16_000001_add_pick_attributes.php');
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

    public function test_it_creates_the_pick_attributes_for_products(): void
    {
        $this->productGroup();

        $this->migration()->up();

        foreach (self::HANDLES as $handle) {
            $this->assertTrue(
                Attribute::query()->where('attribute_type', 'product')->where('handle', $handle)->exists(),
                "Missing attribute {$handle}",
            );
        }
    }

    public function test_it_maps_the_attributes_to_every_existing_product_type(): void
    {
        $this->productGroup();
        $first = ProductType::query()->create(['name' => 'Harnesses']);
        $second = ProductType::query()->create(['name' => 'Bowls']);

        $this->migration()->up();

        foreach ([$first, $second] as $type) {
            $mapped = $type->mappedAttributes()->pluck('handle')->all();
            foreach (self::HANDLES as $handle) {
                $this->assertContains($handle, $mapped);
            }
        }
    }

    public function test_it_is_safe_to_run_twice(): void
    {
        $this->productGroup();
        $type = ProductType::query()->create(['name' => 'Harnesses']);

        $this->migration()->up();
        $this->migration()->up();

        $this->assertSame(
            count(self::HANDLES),
            Attribute::query()->where('attribute_type', 'product')->whereIn('handle', self::HANDLES)->count(),
        );
        $this->assertSame(count(self::HANDLES), $type->mappedAttributes()->whereIn('handle', self::HANDLES)->count());
    }

    public function test_the_fields_are_optional_plain_text_so_existing_products_stay_valid(): void
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

    public function test_down_removes_the_attributes(): void
    {
        $this->productGroup();
        $this->migration()->up();

        $this->migration()->down();

        $this->assertFalse(
            Attribute::query()->where('attribute_type', 'product')->whereIn('handle', self::HANDLES)->exists(),
        );
    }
}
