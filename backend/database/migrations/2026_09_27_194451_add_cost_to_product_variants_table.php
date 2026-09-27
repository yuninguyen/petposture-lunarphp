<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $table = config('lunar.database.table_prefix', 'lunar_').'product_variants';

        Schema::table($table, function (Blueprint $table) {
            $table->decimal('cost', 12, 2)->nullable()->after('stock');
        });
    }

    public function down(): void
    {
        $table = config('lunar.database.table_prefix', 'lunar_').'product_variants';

        Schema::table($table, function (Blueprint $table) {
            $table->dropColumn('cost');
        });
    }
};
