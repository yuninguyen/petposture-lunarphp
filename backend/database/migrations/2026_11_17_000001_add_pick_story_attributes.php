<?php

use Illuminate\Database\Migrations\Migration;
use Lunar\FieldTypes\Text;
use Lunar\Models\Attribute;
use Lunar\Models\AttributeGroup;
use Lunar\Models\ProductType;

// The editorial fields of a "PetPosture Pick" page, next to Pros and Cons. All optional plain text: an empty
// one is simply not shown. Only enter what the seller's listing or customer reviews support; PetPosture does
// not test these products, and the page must not read as if it did.
return new class extends Migration
{
    private const ATTRIBUTES = [
        'our_take' => ['Our take', 'A short note on who this suits and why. Say plainly that it comes from the seller\'s description and customer reviews, not from our own testing.'],
        'best_for_note' => ['Best for (notes)', 'One note per line, shown next to the breed links, e.g. "Small, split meals". Only what the listing or reviews support.'],
        'problem' => ['The problem', 'What goes wrong with an ordinary product for this dog. Keep to what the sources say.'],
        'approach' => ['The PetPosture approach', 'How this product is meant to help. Describe the design, never a result we measured.'],
        'quick_specs' => ['Quick specs', 'One spec per line as "label: value", e.g. "Material: Porcelain". Only enter a spec that has a source; leave the field empty otherwise.'],
    ];

    public function up(): void
    {
        $detailsGroup = AttributeGroup::where('attributable_type', 'product')->first();

        if (! $detailsGroup) {
            return;
        }

        $position = (int) Attribute::where('attribute_type', 'product')->max('position');
        $ids = [];

        foreach (self::ATTRIBUTES as $handle => [$name, $description]) {
            $attribute = Attribute::where('attribute_type', 'product')->where('handle', $handle)->first();

            $ids[] = ($attribute ?? Attribute::create([
                'attribute_type' => 'product',
                'attribute_group_id' => $detailsGroup->id,
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
            fn (ProductType $type) => $type->mappedAttributes()->syncWithoutDetaching($ids),
        );
    }

    public function down(): void
    {
        $attributes = Attribute::where('attribute_type', 'product')
            ->whereIn('handle', array_keys(self::ATTRIBUTES));

        // The product-type pivot references these attributes, so unmap them before deleting.
        $ids = $attributes->pluck('id')->all();
        ProductType::all()->each(fn (ProductType $type) => $type->mappedAttributes()->detach($ids));

        $attributes->delete();
    }
};
