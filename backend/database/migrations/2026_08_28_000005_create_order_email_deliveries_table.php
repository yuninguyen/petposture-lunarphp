<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('order_email_deliveries', function (Blueprint $table) {
            $table->id();
            $table->string('delivery_key')->unique();
            $table->string('job_type');
            $table->unsignedBigInteger('order_id')->index();
            $table->string('recipient');
            $table->string('status')->default('pending')->index();
            $table->unsignedInteger('attempt_count')->default(0);
            $table->string('provider_message_id')->nullable();
            $table->text('last_error')->nullable();
            $table->timestamp('sending_at')->nullable();
            $table->timestamp('sent_at')->nullable();
            $table->timestamp('failed_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('order_email_deliveries');
    }
};
