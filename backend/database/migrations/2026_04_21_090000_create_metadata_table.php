<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('metadata', function (Blueprint $table) {
            $table->id();
            $table->morphs('model');
            $table->string('key')->index();
            $table->text('value')->nullable();
            $table->string('type')->default('string'); // For casting: string, json, int, float, boolean
            $table->timestamps();

            $table->unique(['model_type', 'model_id', 'key']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('metadata');
    }
};
