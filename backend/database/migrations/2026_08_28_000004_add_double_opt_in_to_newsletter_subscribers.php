<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('newsletter_subscribers', function (Blueprint $table) {
            $table->text('confirmation_token')->nullable();
            $table->string('confirmation_token_hash', 64)->nullable()->unique();
            $table->timestamp('confirmation_expires_at')->nullable();
            $table->timestamp('confirmed_at')->nullable();
            $table->text('unsubscribe_token')->nullable();
            $table->string('unsubscribe_token_hash', 64)->nullable()->unique();
            $table->string('mail_status')->default('pending')->index();
            $table->unsignedInteger('mail_attempts')->default(0);
            $table->text('mail_last_error')->nullable();
            $table->timestamp('mail_sent_at')->nullable();
            $table->timestamp('mail_failed_at')->nullable();
        });

        DB::table('newsletter_subscribers')
            ->where('status', 'subscribed')
            ->update([
                'confirmed_at' => DB::raw('created_at'),
                'mail_status' => 'sent',
            ]);

        Schema::table('newsletter_subscribers', function (Blueprint $table) {
            $table->string('status')->default('pending')->change();
        });
    }

    public function down(): void
    {
        Schema::table('newsletter_subscribers', function (Blueprint $table) {
            $table->dropUnique(['confirmation_token_hash']);
            $table->dropUnique(['unsubscribe_token_hash']);
            $table->dropColumn([
                'confirmation_token',
                'confirmation_token_hash',
                'confirmation_expires_at',
                'confirmed_at',
                'unsubscribe_token',
                'unsubscribe_token_hash',
                'mail_status',
                'mail_attempts',
                'mail_last_error',
                'mail_sent_at',
                'mail_failed_at',
            ]);
            $table->string('status')->default('subscribed')->change();
        });
    }
};
