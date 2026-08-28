<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('lunar_orders', function (Blueprint $table) {
            $table->char('tracking_access_token_hash', 64)->nullable()->unique();
            $table->timestamp('tracking_access_token_expires_at')->nullable()->index();
        });
    }

    public function down(): void
    {
        Schema::table('lunar_orders', function (Blueprint $table) {
            $table->dropUnique(['tracking_access_token_hash']);
            $table->dropIndex(['tracking_access_token_expires_at']);
            $table->dropColumn([
                'tracking_access_token_hash',
                'tracking_access_token_expires_at',
            ]);
        });
    }
};
