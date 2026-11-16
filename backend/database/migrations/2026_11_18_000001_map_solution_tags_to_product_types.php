<?php

use Illuminate\Database\Migrations\Migration;
use Lunar\Models\Attribute;
use Lunar\Models\ProductType;

// "Solution Tags" was added in August but never mapped to a product type, and Lunar only shows an attribute in the
// admin product form once its product type has it. So nobody could enter one, and every Pick (and product) has none.
// The /picks Solution filter is built from these tags, so map the attribute to every product type and say which
// slugs the site uses (the old description still named slugs that no longer exist).
//
// The attribute is not created here: it is only mapped when it exists. Down unmaps it and keeps the attribute and the
// tags already typed in.
return new class extends Migration
{
    private const DESCRIPTION = 'Comma-separated solution slugs: feeding, comfort, mobility, walking. A Pick appears under each one in the Solution filter of /picks.';

    public function up(): void
    {
        $attribute = Attribute::where('attribute_type', 'product')->where('handle', 'solution_tags')->first();

        if (! $attribute) {
            return;
        }

        $attribute->update(['description' => self::DESCRIPTION]);

        ProductType::all()->each(
            fn (ProductType $type) => $type->mappedAttributes()->syncWithoutDetaching([$attribute->id]),
        );
    }

    public function down(): void
    {
        $attribute = Attribute::where('attribute_type', 'product')->where('handle', 'solution_tags')->first();

        if (! $attribute) {
            return;
        }

        ProductType::all()->each(fn (ProductType $type) => $type->mappedAttributes()->detach([$attribute->id]));
    }
};
