<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        // 1. Attributes (e.g. Color, Size)
        Schema::create('product_attributes', function (Blueprint $table) {
            $table->id();
            $table->string('name'); // Color
            $table->string('handle')->unique(); // color
            $table->timestamps();
        });

        // 2. Attribute Values (e.g. Red, Blue, XL)
        Schema::create('product_attribute_values', function (Blueprint $table) {
            $table->id();
            $table->foreignId('attribute_id')->constrained('product_attributes')->onDelete('cascade');
            $table->string('value'); // Red
            $table->timestamps();
        });

        // 3. Product Variants (Specific combinations / SKUs)
        Schema::create('product_variants', function (Blueprint $table) {
            $table->id();
            $table->foreignId('product_id')->constrained('products')->onDelete('cascade');
            $table->string('sku')->unique();
            $table->decimal('price', 12, 2)->nullable();
            $table->integer('stock')->default(0);
            $table->string('image_url')->nullable();
            $table->timestamps();
        });

        // 4. Pivot: Variant <-> Attribute Values
        Schema::create('product_variant_attribute_value', function (Blueprint $table) {
            $table->id();
            $table->foreignId('variant_id')->constrained('product_variants')->onDelete('cascade');
            $table->foreignId('attribute_value_id')->constrained('product_attribute_values')->onDelete('cascade');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('product_variant_attribute_value');
        Schema::dropIfExists('product_variants');
        Schema::dropIfExists('product_attribute_values');
        Schema::dropIfExists('product_attributes');
    }
};
