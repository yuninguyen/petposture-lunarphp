<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('curator_media', function (Blueprint $table): void {
            $table->string('folder')->nullable()->index();
        });
    }

    public function down(): void
    {
        Schema::table('curator_media', function (Blueprint $table): void {
            $table->dropIndex(['folder']);
            $table->dropColumn('folder');
        });
    }
};
