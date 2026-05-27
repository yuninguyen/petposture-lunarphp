<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('checkout_sessions', function (Blueprint $table) {
            $table->id();
            $table->uuid('token')->unique();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('status')->default('cart');
            $table->json('payload')->nullable();
            $table->json('totals')->nullable();
            $table->string('currency', 10)->default('USD');
            $table->string('payment_intent_id')->nullable();
            $table->text('payment_client_secret')->nullable();
            $table->string('order_reference')->nullable();
            $table->timestamp('expires_at')->nullable()->index();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('checkout_sessions');
    }
};
