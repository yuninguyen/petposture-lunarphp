<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('storefront_refresh_journal', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->json('cache_keys');
            $table->string('state', 16)->default('pending');
            $table->unsignedTinyInteger('recovery_attempts')->default(0);
            $table->boolean('initial_attempted')->default(false);
            $table->timestamp('next_attempt_at');
            $table->timestamp('next_dispatch_at');
            $table->uuid('lease_token')->nullable();
            $table->timestamp('lease_expires_at')->nullable();
            $table->string('last_status', 32)->nullable();
            $table->timestamps();
            $table->timestamp('completed_at')->nullable();
            $table->index(['state', 'next_dispatch_at'], 'refresh_journal_dispatch');
            $table->index(['state', 'lease_expires_at'], 'refresh_journal_lease');
            $table->index(['state', 'completed_at'], 'refresh_journal_cleanup');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('storefront_refresh_journal');
    }
};
