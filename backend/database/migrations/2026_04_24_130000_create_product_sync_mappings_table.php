<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('product_sync_mappings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('legacy_product_id')->constrained('products')->cascadeOnDelete();
            $table->unsignedBigInteger('lunar_product_id')->unique();
            $table->string('legacy_slug');
            $table->timestamp('synced_at')->nullable();
            $table->timestamps();

            $table->unique('legacy_product_id');
            $table->index('legacy_slug');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('product_sync_mappings');
    }
};
