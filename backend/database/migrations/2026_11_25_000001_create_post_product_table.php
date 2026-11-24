<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// The Picks a post mentions, set from the Post side only. Same shape as breed_product / post_breed. A row is only
// removed when the post or the product is deleted; unpublishing either side hides the link when it is read.
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('post_product', function (Blueprint $table) {
            $table->id();
            $table->foreignId('post_id')->constrained()->cascadeOnDelete();
            $table->foreignId('lunar_product_id')->constrained('lunar_products')->cascadeOnDelete();
            $table->timestamps();

            $table->unique(['post_id', 'lunar_product_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('post_product');
    }
};
