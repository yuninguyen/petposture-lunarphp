<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('shipping_methods', function (Blueprint $table) {
            $table->id();
            $table->string('code')->unique();
            $table->string('name');
            $table->string('eta')->nullable();
            $table->decimal('price', 8, 2)->default(0);
            $table->decimal('free_over', 8, 2)->nullable();
            $table->timestamps();
        });

        DB::table('shipping_methods')->insert([
            [
                'code' => 'standard',
                'name' => 'Standard Shipping',
                'eta' => '5-7 business days',
                'price' => 15.00,
                'free_over' => 50.00,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'code' => 'express',
                'name' => 'Express Shipping',
                'eta' => '1-2 business days',
                'price' => 25.00,
                'free_over' => null,
                'created_at' => now(),
                'updated_at' => now(),
            ],
        ]);
    }

    public function down(): void
    {
        Schema::dropIfExists('shipping_methods');
    }
};
