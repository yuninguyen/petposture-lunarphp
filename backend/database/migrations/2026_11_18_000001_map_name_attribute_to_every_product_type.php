<?php

use Illuminate\Database\Migrations\Migration;
use Lunar\Models\Attribute;
use Lunar\Models\ProductType;

// The product form builds its fields from the attributes mapped to the product's type. "General" (the type the
// Picks use) never had `name` mapped, so opening a Pick showed "Untitled product" and no Title field, while the
// list kept showing the right name. Map it to every type that lacks it; products keep the name they already have.
return new class extends Migration
{
    public function up(): void
    {
        $name = Attribute::where('attribute_type', 'product')->where('handle', 'name')->first();

        if (! $name) {
            return;
        }

        ProductType::all()->each(
            fn (ProductType $type) => $type->mappedAttributes()->syncWithoutDetaching([$name->id]),
        );
    }

    public function down(): void
    {
        // Left mapped: removing the Title field again would bring the bug back, and other types had it from the start.
    }
};
