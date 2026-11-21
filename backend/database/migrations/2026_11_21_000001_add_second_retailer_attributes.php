<?php

use Illuminate\Database\Migrations\Migration;
use Lunar\FieldTypes\Text;
use Lunar\Models\Attribute;
use Lunar\Models\AttributeGroup;
use Lunar\Models\ProductType;

// A Pick can have a second store to buy from, next to the first (Retailer URL). Both fields are optional plain text:
// the second button on the Pick page only shows when the slug names an affiliate network that exists and the URL is a
// web address, so leaving either empty simply shows nothing.
return new class extends Migration
{
    private const ATTRIBUTES = [
        'second_retailer_slug' => ['Second retailer (affiliate network slug)', 'Optional. The slug of the second store\'s affiliate network, e.g. "petsmart"; its name is the button label ("Buy on PetSmart"). The button shows only when this matches a network and the URL below is a web address.'],
        'second_retailer_url' => ['Second retailer URL', 'Optional. The product page at the second store, only for the exact same product, size and colour. No price is shown for it.'],
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
