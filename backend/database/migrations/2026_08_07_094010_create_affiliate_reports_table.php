<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('affiliate_reports', function (Blueprint $table) {
            $table->id();
            $table->foreignId('affiliate_network_id')->constrained()->cascadeOnDelete();
            $table->date('date');
            $table->unsignedInteger('clicks')->default(0);
            $table->unsignedInteger('conversions')->default(0);
            $table->decimal('commission_amount', 10, 2)->default(0);
            $table->timestamp('synced_at')->nullable();
            $table->timestamps();

            $table->unique(['affiliate_network_id', 'date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('affiliate_reports');
    }
};
