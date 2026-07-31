<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('user_wishlist_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('lunar_product_id')->constrained('lunar_products')->cascadeOnDelete();
            $table->timestamps();

            $table->unique(['user_id', 'lunar_product_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('user_wishlist_items');
    }
};
