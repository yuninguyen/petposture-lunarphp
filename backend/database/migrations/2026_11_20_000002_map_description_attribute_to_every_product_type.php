<?php

use Illuminate\Database\Migrations\Migration;
use Lunar\Models\Attribute;
use Lunar\Models\ProductType;

// The product form builds its fields from the attributes mapped to the product's type. `description` was mapped only
// to "Harnesses", so the Picks of type "General" had no Description box in the admin and nobody could enter one.
// Map it to every type that lacks it; products keep any description they already have.
return new class extends Migration
{
    public function up(): void
    {
        $description = Attribute::where('attribute_type', 'product')->where('handle', 'description')->first();

        if (! $description) {
            return;
        }

        ProductType::all()->each(
            fn (ProductType $type) => $type->mappedAttributes()->syncWithoutDetaching([$description->id]),
        );
    }

    public function down(): void
    {
        // Left mapped: removing the box again would hide descriptions that were typed in, and Harnesses had it from the start.
    }
};
