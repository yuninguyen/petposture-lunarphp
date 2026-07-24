<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $ordersTable = config('lunar.database.table_prefix', 'lunar_') . 'orders';
        $orderLinesTable = config('lunar.database.table_prefix', 'lunar_') . 'order_lines';

        Schema::create('order_shipments', function (Blueprint $table) use ($ordersTable) {
            $table->id();
            $table->foreignId('order_id')->constrained($ordersTable)->cascadeOnDelete();
            $table->string('tracking_number');
            $table->string('carrier', 40)->default('manual');
            $table->string('tracking_url')->nullable();
            $table->string('status', 20)->default('label_created');
            $table->timestamp('shipped_at')->nullable();
            $table->timestamp('delivered_at')->nullable();
            $table->timestamps();

            $table->index(['order_id', 'status']);
            $table->index('tracking_number');
        });

        Schema::create('order_shipment_items', function (Blueprint $table) use ($orderLinesTable) {
            $table->id();
            $table->foreignId('order_shipment_id')->constrained('order_shipments')->cascadeOnDelete();
            $table->foreignId('order_line_id')->constrained($orderLinesTable)->cascadeOnDelete();
            $table->unsignedInteger('quantity');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('order_shipment_items');
        Schema::dropIfExists('order_shipments');
    }
};
