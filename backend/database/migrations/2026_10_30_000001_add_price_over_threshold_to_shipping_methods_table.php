<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('shipping_methods', function (Blueprint $table) {
            // Price charged once the subtotal reaches free_over. NULL keeps the original behavior (free).
            $table->decimal('price_over_threshold', 8, 2)->nullable()->after('free_over');
        });

        // Express was never free; orders of $50+ now get Standard free and Express at a reduced $12.
        DB::table('shipping_methods')
            ->where('code', 'express')
            ->whereNull('free_over')
            ->update([
                'free_over' => 50.00,
                'price_over_threshold' => 12.00,
                'updated_at' => now(),
            ]);
    }

    public function down(): void
    {
        DB::table('shipping_methods')
            ->where('code', 'express')
            ->where('free_over', 50.00)
            ->where('price_over_threshold', 12.00)
            ->update(['free_over' => null, 'updated_at' => now()]);

        Schema::table('shipping_methods', function (Blueprint $table) {
            $table->dropColumn('price_over_threshold');
        });
    }
};
