<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('reviews', function (Blueprint $blueprint) {
            $blueprint->id();
            $blueprint->foreignId('product_id')->constrained()->onDelete('cascade');
            $blueprint->string('customer_name');
            $blueprint->integer('rating');
            $blueprint->text('comment');
            $blueprint->boolean('is_verified')->default(false);
            $blueprint->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('reviews');
    }
};
