<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('post_breed', function (Blueprint $table) {
            $table->id();
            $table->foreignId('breed_id')->constrained()->cascadeOnDelete();
            $table->foreignId('post_id')->constrained()->cascadeOnDelete();
            $table->timestamps();

            $table->unique(['breed_id', 'post_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('post_breed');
    }
};
