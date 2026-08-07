<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('affiliate_networks', function (Blueprint $table) {
            $table->string('provider')->nullable()->after('slug');
            $table->text('api_key')->nullable()->after('provider');
            $table->text('api_secret')->nullable()->after('api_key');
            $table->string('merchant_id')->nullable()->after('api_secret');
            $table->string('commission_rate_default')->nullable()->after('merchant_id');
            $table->unsignedSmallInteger('cookie_days')->nullable()->after('commission_rate_default');
            $table->timestamp('last_synced_at')->nullable()->after('cookie_days');
        });
    }

    public function down(): void
    {
        Schema::table('affiliate_networks', function (Blueprint $table) {
            $table->dropColumn([
                'provider',
                'api_key',
                'api_secret',
                'merchant_id',
                'commission_rate_default',
                'cookie_days',
                'last_synced_at',
            ]);
        });
    }
};
