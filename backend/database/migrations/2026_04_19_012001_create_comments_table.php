<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('comments', function (Blueprint $blueprint) {
            $blueprint->id();
            $blueprint->foreignId('post_id')->constrained()->onDelete('cascade');
            $blueprint->string('customer_name');
            $blueprint->text('comment');
            $blueprint->string('status')->default('pending'); // pending, approved, rejected
            $blueprint->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('comments');
    }
};
