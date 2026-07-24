<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('order_return_requests', function (Blueprint $table) {
            $table->unsignedInteger('restocking_fee_minor')->nullable()->after('refund_amount_minor');
            $table->boolean('fee_waived')->default(false)->after('restocking_fee_minor');
        });
    }

    public function down(): void
    {
        Schema::table('order_return_requests', function (Blueprint $table) {
            $table->dropColumn(['restocking_fee_minor', 'fee_waived']);
        });
    }
};
