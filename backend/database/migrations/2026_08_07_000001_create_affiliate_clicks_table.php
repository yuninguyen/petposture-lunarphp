<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('affiliate_clicks', function (Blueprint $table) {
            $table->id();
            $table->foreignId('post_id')->constrained()->cascadeOnDelete();
            $table->foreignId('affiliate_network_id')->nullable()->constrained()->nullOnDelete();
            $table->string('product_name')->nullable();
            $table->string('target_url', 2048);
            $table->string('referrer')->nullable();
            $table->timestamps();

            $table->index(['post_id', 'created_at']);
            $table->index(['affiliate_network_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('affiliate_clicks');
    }
};
