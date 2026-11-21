<?php

use Illuminate\Database\Migrations\Migration;
use Lunar\FieldTypes\Text;
use Lunar\Models\Attribute;
use Lunar\Models\AttributeGroup;
use Lunar\Models\ProductType;

// The price of the second store (for example PetSmart) and the date it was checked, so the Pick page can show both stores
// in one price table. Like the first store's price they are plain text, and a price is only ever shown with its date.
return new class extends Migration
{
    private const ATTRIBUTES = [
        'second_retailer_price' => ['Second retailer price (USD)', 'Optional. The second store\'s price for the same product, size and colour, e.g. "40.99". Never shown without a checked date.'],
        'second_retailer_price_checked_date' => ['Second retailer price checked date', 'Date the second store\'s price was checked, as YYYY-MM-DD.'],
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
