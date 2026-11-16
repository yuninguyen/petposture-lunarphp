<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // The one Pinterest account the admin is connected to. Tokens are stored encrypted (model casts).
        Schema::create('pinterest_connections', function (Blueprint $table) {
            $table->id();
            $table->string('pinterest_user_id')->nullable();
            $table->string('username')->nullable();
            $table->text('access_token');
            $table->text('refresh_token')->nullable();
            $table->dateTime('access_expires_at')->nullable();
            $table->dateTime('refresh_expires_at')->nullable();
            $table->string('scopes')->nullable();
            $table->string('status', 16)->default('connected');
            $table->text('last_error')->nullable();
            $table->dateTime('last_refreshed_at')->nullable();
            $table->dateTime('expiry_warned_at')->nullable();
            $table->timestamps();
        });

        Schema::table('pinterest_pins', function (Blueprint $table) {
            $table->string('pinterest_board_id', 64)->nullable()->after('board');
            $table->string('pinterest_pin_id', 64)->nullable()->after('pinterest_board_id');
            // How the pin got posted: by hand in Pinterest, or by the API job.
            $table->string('posted_via', 16)->nullable()->after('posted_at');
            $table->unsignedSmallInteger('publish_attempts')->default(0)->after('posted_via');
            $table->dateTime('last_attempt_at')->nullable()->after('publish_attempts');
            $table->text('last_error')->nullable()->after('last_attempt_at');
        });

        // One row per call to Pinterest. Never holds a token or an Authorization header.
        Schema::create('pinterest_publish_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('pinterest_pin_id')->nullable()->constrained('pinterest_pins')->nullOnDelete();
            $table->string('action', 32);
            $table->string('endpoint', 128);
            $table->unsignedSmallInteger('http_status')->nullable();
            $table->string('error_code', 64)->nullable();
            $table->text('message')->nullable();
            $table->unsignedInteger('duration_ms')->nullable();
            $table->timestamp('created_at')->useCurrent();

            $table->index(['pinterest_pin_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('pinterest_publish_logs');

        Schema::table('pinterest_pins', function (Blueprint $table) {
            $table->dropColumn(['pinterest_board_id', 'pinterest_pin_id', 'posted_via', 'publish_attempts', 'last_attempt_at', 'last_error']);
        });

        Schema::dropIfExists('pinterest_connections');
    }
};
