<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('order_return_requests', function (Blueprint $table) {
            $table->string('return_tracking_number')->nullable()->after('rma_address');
            $table->string('return_carrier', 40)->nullable()->after('return_tracking_number');
            $table->string('return_tracking_url')->nullable()->after('return_carrier');
            $table->timestamp('package_received_at')->nullable()->after('return_tracking_url');
        });
    }

    public function down(): void
    {
        Schema::table('order_return_requests', function (Blueprint $table) {
            $table->dropColumn(['return_tracking_number', 'return_carrier', 'return_tracking_url', 'package_received_at']);
        });
    }
};
