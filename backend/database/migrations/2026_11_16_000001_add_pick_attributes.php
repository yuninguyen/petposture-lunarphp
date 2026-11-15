<?php

use Illuminate\Database\Migrations\Migration;
use Lunar\FieldTypes\Text;
use Lunar\Models\Attribute;
use Lunar\Models\AttributeGroup;
use Lunar\Models\ProductType;

// Fields for a "PetPosture Pick": an affiliate product page that sends readers to a retailer.
// Stored as Lunar attributes (like breed_tags), so the admin product form shows them without
// any new table column. The reference price is the retailer's price, never PetPosture's.
return new class extends Migration
{
    private const ATTRIBUTES = [
        'external_url' => ['Retailer URL', 'Plain Chewy/Amazon product URL, or an affiliate-tagged URL later.'],
        'affiliate_network_slug' => ['Retailer (affiliate network slug)', 'Slug of the affiliate network, e.g. "chewy" or "amazon". Used to count clicks.'],
        'reference_price' => ['Retailer reference price (USD)', 'The retailer\'s price, e.g. "49.96". Never shown without a checked date.'],
        'price_checked_date' => ['Price checked date', 'Date the retailer price was checked, as YYYY-MM-DD.'],
        'best_for_breeds' => ['Best for breeds', 'Comma-separated breed slugs, e.g. "french-bulldog,pug"'],
        'pros' => ['Pros', 'One pro per line.'],
        'cons' => ['Cons', 'One honest con per line, taken from real reviews.'],
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
