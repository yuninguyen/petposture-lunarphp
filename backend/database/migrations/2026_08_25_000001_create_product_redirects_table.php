<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('product_redirects', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('product_id')->constrained('lunar_products')->cascadeOnDelete();
            $table->string('old_slug')->index();
            $table->timestamp('created_at')->useCurrent();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('product_redirects');
    }
};
