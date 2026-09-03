<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('order_tracking_tokens', function (Blueprint $table) {
            $table->id();
            $table->foreignId('order_id')->constrained('lunar_orders')->cascadeOnDelete();
            $table->char('token_hash', 64)->unique();
            $table->timestamp('expires_at');
            $table->timestamp('created_at')->nullable();
            $table->index(['order_id', 'expires_at']);
        });

        DB::table('lunar_orders')
            ->select(['id', 'tracking_access_token_hash', 'tracking_access_token_expires_at'])
            ->whereNotNull('tracking_access_token_hash')
            ->where('tracking_access_token_expires_at', '>', now())
            ->orderBy('id')
            ->chunkById(500, function ($orders) {
                DB::table('order_tracking_tokens')->insert($orders->map(fn ($order) => [
                    'order_id' => $order->id,
                    'token_hash' => $order->tracking_access_token_hash,
                    'expires_at' => $order->tracking_access_token_expires_at,
                    'created_at' => now(),
                ])->all());
            });
    }

    public function down(): void
    {
        Schema::dropIfExists('order_tracking_tokens');
    }
};
