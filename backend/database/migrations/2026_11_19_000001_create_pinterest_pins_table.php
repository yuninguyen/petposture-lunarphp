<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Pinterest pins prepared in the admin and posted by hand: a 2:3 image, the title and description to paste, and
// the link back to the blog post (or a Pick page). Nothing here talks to Pinterest.
//
// `status` is a plain string kept to "ready" / "posted" by the model and the admin API, not a database enum, so
// the same migration runs on every database the project uses.
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('pinterest_pins', function (Blueprint $table) {
            $table->id();
            // The pin outlives its post: deleting the post only clears the link.
            $table->foreignId('post_id')->nullable()->constrained('posts')->nullOnDelete();
            $table->string('image');
            $table->string('title', 100);
            $table->string('description', 500);
            $table->string('destination_url', 2048);
            $table->string('board')->nullable();
            $table->string('status', 16)->default('ready');
            $table->date('scheduled_date')->nullable();
            $table->dateTime('posted_at')->nullable();
            $table->timestamps();

            $table->index(['status', 'scheduled_date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('pinterest_pins');
    }
};
