<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('reviews', function (Blueprint $table) {
            $table->foreignId('lunar_product_id')->nullable()->after('id')->constrained('lunar_products')->cascadeOnDelete();
            $table->dropForeign(['product_id']);
            $table->dropColumn('product_id');
        });
    }

    public function down(): void
    {
        Schema::table('reviews', function (Blueprint $table) {
            $table->dropForeign(['lunar_product_id']);
            $table->dropColumn('lunar_product_id');
            $table->foreignId('product_id')->after('id')->constrained()->cascadeOnDelete();
        });
    }
};
