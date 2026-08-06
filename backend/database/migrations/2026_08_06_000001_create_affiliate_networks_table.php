<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('affiliate_networks', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('slug')->unique();
            $table->string('logo')->nullable();
            $table->boolean('active')->default(true);
            $table->timestamps();
        });

        DB::table('affiliate_networks')->insert([
            ['name' => 'Chewy', 'slug' => 'chewy', 'active' => true, 'created_at' => now(), 'updated_at' => now()],
            ['name' => 'Amazon', 'slug' => 'amazon', 'active' => true, 'created_at' => now(), 'updated_at' => now()],
            ['name' => 'Walmart', 'slug' => 'walmart', 'active' => true, 'created_at' => now(), 'updated_at' => now()],
            ['name' => 'Petco', 'slug' => 'petco', 'active' => true, 'created_at' => now(), 'updated_at' => now()],
            ['name' => 'PetSmart', 'slug' => 'petsmart', 'active' => true, 'created_at' => now(), 'updated_at' => now()],
        ]);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('affiliate_networks');
    }
};
