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
        if (! Schema::hasColumn('posts', 'featured_media_id')) {
            Schema::table('posts', function (Blueprint $table) {
                $table->foreignId('featured_media_id')->nullable()->after('featured_image_alt')
                    ->constrained('curator_media')->nullOnDelete();
            });

            return;
        }

        $hasForeignKey = DB::table('information_schema.KEY_COLUMN_USAGE')
            ->where('TABLE_SCHEMA', DB::getDatabaseName())
            ->where('TABLE_NAME', 'posts')
            ->where('COLUMN_NAME', 'featured_media_id')
            ->whereNotNull('REFERENCED_TABLE_NAME')
            ->exists();

        if (! $hasForeignKey) {
            Schema::table('posts', function (Blueprint $table) {
                $table->foreign('featured_media_id')->references('id')->on('curator_media')->nullOnDelete();
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('posts', function (Blueprint $table) {
            $table->dropConstrainedForeignId('featured_media_id');
        });
    }
};
