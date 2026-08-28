<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('checkout_sessions', function (Blueprint $table) {
            $table->char('payment_intent_idempotency_key_hash', 64)->nullable();
            $table->json('payment_intent_response')->nullable();
            $table->char('confirm_idempotency_key_hash', 64)->nullable();
            $table->char('previous_token_hash', 64)->nullable()->index();
        });

        DB::table('checkout_sessions')
            ->whereIn('status', ['cart', 'address', 'shipping'])
            ->update(['status' => 'open']);

        DB::table('checkout_sessions')
            ->whereIn('status', ['payment', 'confirm'])
            ->update(['status' => 'payment_pending']);

        DB::table('checkout_sessions')
            ->where('status', 'completed')
            ->update(['status' => 'consumed']);
    }

    public function down(): void
    {
        Schema::table('checkout_sessions', function (Blueprint $table) {
            $table->dropIndex(['previous_token_hash']);
            $table->dropColumn([
                'payment_intent_idempotency_key_hash',
                'payment_intent_response',
                'confirm_idempotency_key_hash',
                'previous_token_hash',
            ]);
        });
    }
};
