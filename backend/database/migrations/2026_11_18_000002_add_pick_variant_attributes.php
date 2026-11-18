<?php

use Illuminate\Database\Migrations\Migration;
use Lunar\FieldTypes\Text;
use Lunar\Models\Attribute;
use Lunar\Models\AttributeGroup;
use Lunar\Models\ProductType;
use Lunar\Models\ProductVariant;

// A Pick with more than one variant (for example two colours) needs its own retailer link and price per
// variant. Both are optional: a variant that leaves them empty uses the product's own values, so a Pick with a
// single variant keeps working exactly as before.
return new class extends Migration
{
    private const ATTRIBUTES = [
        'external_url' => ['Retailer URL (this variant)', 'The retailer page of this variant, e.g. its own colour. Leave empty to use the product\'s Retailer URL.'],
        'reference_price' => ['Reference price (this variant)', 'The retailer\'s price for this variant, as a number like 49.95. Leave empty to use the product\'s reference price.'],
    ];

    public function up(): void
    {
        $type = ProductVariant::morphName();

        $group = AttributeGroup::where('attributable_type', $type)->first() ?? AttributeGroup::create([
            'attributable_type' => $type,
            'name' => ['en' => 'Pick variant details'],
            'handle' => 'pick_variant_details',
            'position' => 1,
        ]);

        $position = (int) Attribute::where('attribute_type', $type)->max('position');
        $ids = [];

        foreach (self::ATTRIBUTES as $handle => [$name, $description]) {
            $attribute = Attribute::where('attribute_type', $type)->where('handle', $handle)->first();

            $ids[] = ($attribute ?? Attribute::create([
                'attribute_type' => $type,
                'attribute_group_id' => $group->id,
                'position' => ++$position,
                'name' => ['en' => $name],
                'description' => $description,
                'handle' => $handle,
                'section' => null,
                'type' => Text::class,
                'required' => false,
                'default_value' => null,
                'configuration' => ['richtext' => false],
                'system' => false,
                'validation_rules' => null,
                'filterable' => false,
                'searchable' => false,
            ]))->id;
        }

        ProductType::all()->each(
            fn (ProductType $productType) => $productType->mappedAttributes()->syncWithoutDetaching($ids),
        );
    }

    public function down(): void
    {
        $attributes = Attribute::where('attribute_type', ProductVariant::morphName())->whereIn('handle', array_keys(self::ATTRIBUTES));

        $ids = $attributes->pluck('id')->all();
        ProductType::all()->each(fn (ProductType $productType) => $productType->mappedAttributes()->detach($ids));

        $attributes->delete();
    }
};
