<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('posts', function (Blueprint $blueprint) {
            $blueprint->id();
            $blueprint->string('title');
            $blueprint->string('slug')->unique();
            $blueprint->text('content');
            $blueprint->string('featured_image')->nullable();
            $blueprint->string('status')->default('draft');
            $blueprint->timestamp('published_at')->nullable();
            $blueprint->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('posts');
    }
};
