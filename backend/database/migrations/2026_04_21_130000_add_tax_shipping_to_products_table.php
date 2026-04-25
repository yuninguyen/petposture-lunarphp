<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            // Tax
            $table->string('tax_status')->default('taxable'); // taxable, shipping, none
            $table->string('tax_class')->default('standard'); // standard, reduced-rate, zero-rate

            // Shipping
            $table->decimal('weight', 10, 2)->nullable();
            $table->decimal('length', 10, 2)->nullable();
            $table->decimal('width', 10, 2)->nullable();
            $table->decimal('height', 10, 2)->nullable();
            $table->string('shipping_class')->nullable();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->dropColumn([
                'tax_status',
                'tax_class',
                'weight',
                'length',
                'width',
                'height',
                'shipping_class'
            ]);
        });
    }
};
