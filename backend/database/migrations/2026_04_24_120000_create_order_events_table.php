<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $ordersTable = config('lunar.database.table_prefix', 'lunar_') . 'orders';

        Schema::create('order_events', function (Blueprint $table) use ($ordersTable) {
            $table->id();
            $table->foreignId('order_id')->constrained($ordersTable)->cascadeOnDelete();
            $table->string('type', 120);
            $table->string('title', 160);
            $table->text('detail')->nullable();
            $table->json('meta')->nullable();
            $table->timestamp('occurred_at')->nullable()->index();
            $table->timestamps();

            $table->index(['order_id', 'type']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('order_events');
    }
};
