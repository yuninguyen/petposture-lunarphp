<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $ordersTable = config('lunar.database.table_prefix', 'lunar_') . 'orders';

        Schema::create('stripe_webhook_events', function (Blueprint $table) use ($ordersTable) {
            $table->id();
            $table->string('event_id')->unique();
            $table->string('event_type', 120)->nullable()->index();
            $table->string('payment_intent_id')->nullable()->index();
            $table->foreignId('order_id')->nullable()->constrained($ordersTable)->nullOnDelete();
            $table->string('status', 32)->default('received')->index();
            $table->json('payload');
            $table->timestamp('processed_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('stripe_webhook_events');
    }
};
