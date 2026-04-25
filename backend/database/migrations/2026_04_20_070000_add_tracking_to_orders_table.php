<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $blueprint) {
            if (!Schema::hasColumn('orders', 'email')) {
                $blueprint->string('email')->after('user_id')->nullable();
            }
            if (!Schema::hasColumn('orders', 'tracking_number')) {
                $blueprint->string('tracking_number')->after('shipping_address')->nullable()->unique();
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('orders', function (Blueprint $blueprint) {
            $blueprint->dropColumn(['email', 'tracking_number']);
        });
    }
};
