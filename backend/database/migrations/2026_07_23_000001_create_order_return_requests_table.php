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

        Schema::create('order_return_requests', function (Blueprint $table) use ($ordersTable) {
            $table->id();
            $table->foreignId('order_id')->constrained($ordersTable)->cascadeOnDelete();
            $table->string('status', 20)->default('requested');
            $table->string('reason', 160)->nullable();
            $table->text('customer_note')->nullable();
            $table->text('admin_note')->nullable();
            $table->text('rma_address')->nullable();
            $table->unsignedInteger('refund_amount_minor')->nullable();
            $table->timestamp('requested_at');
            $table->timestamp('approved_at')->nullable();
            $table->timestamp('rejected_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->json('meta')->nullable();
            $table->timestamps();

            $table->index(['order_id', 'status']);
        });

        Schema::create('order_return_request_items', function (Blueprint $table) use ($orderLinesTable) {
            $table->id();
            $table->foreignId('return_request_id')->constrained('order_return_requests')->cascadeOnDelete();
            $table->foreignId('order_line_id')->constrained($orderLinesTable)->cascadeOnDelete();
            $table->unsignedInteger('quantity');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('order_return_request_items');
        Schema::dropIfExists('order_return_requests');
    }
};
