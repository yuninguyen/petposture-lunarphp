<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('breed_product', function (Blueprint $table) {
            $table->id();
            $table->foreignId('breed_id')->constrained()->cascadeOnDelete();
            $table->foreignId('lunar_product_id')->constrained('lunar_products')->cascadeOnDelete();
            $table->unsignedInteger('priority')->default(0);
            $table->timestamps();

            $table->unique(['breed_id', 'lunar_product_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('breed_product');
    }
};
