<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $ordersTable = config('lunar.database.table_prefix', 'lunar_').'orders';
        $orderLinesTable = config('lunar.database.table_prefix', 'lunar_').'order_lines';

        Schema::table('reviews', function (Blueprint $table) use ($ordersTable, $orderLinesTable) {
            $table->foreignId('user_id')->nullable()->after('lunar_product_id')->constrained()->nullOnDelete();
            $table->string('customer_email')->nullable()->after('customer_name')->index();
            $table->foreignId('lunar_order_id')->nullable()->after('customer_email')->constrained($ordersTable)->nullOnDelete();
            $table->foreignId('lunar_order_line_id')->nullable()->after('lunar_order_id')->constrained($orderLinesTable)->nullOnDelete();
            $table->string('status')->default('pending')->after('is_verified')->index();
        });

        DB::table('reviews')->update(['status' => 'approved']);
    }

    public function down(): void
    {
        Schema::table('reviews', function (Blueprint $table) {
            $table->dropForeign(['user_id']);
            $table->dropForeign(['lunar_order_id']);
            $table->dropForeign(['lunar_order_line_id']);
            $table->dropIndex(['customer_email']);
            $table->dropIndex(['status']);
            $table->dropColumn([
                'user_id',
                'customer_email',
                'lunar_order_id',
                'lunar_order_line_id',
                'status',
            ]);
        });
    }
};
