<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Lunar\Models\Product;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('lunar_products', function (Blueprint $table) {
            $table->string('badge_slug')->nullable()->index();
        });

        Product::query()->select(['id', 'attribute_data'])->chunkById(100, function ($products): void {
            foreach ($products as $product) {
                $badge = trim((string) $product->translateAttribute('badge'));
                DB::table('lunar_products')->where('id', $product->id)->update([
                    'badge_slug' => $badge === '' ? null : Str::slug($badge),
                ]);
            }
        });
    }

    public function down(): void
    {
        Schema::table('lunar_products', function (Blueprint $table) {
            $table->dropIndex(['badge_slug']);
            $table->dropColumn('badge_slug');
        });
    }
};
