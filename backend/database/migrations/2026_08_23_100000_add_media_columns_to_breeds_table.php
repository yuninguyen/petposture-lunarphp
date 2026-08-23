<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('breeds', function (Blueprint $table) {
            $table->string('featured_image')->nullable()->after('description');
            $table->string('featured_image_alt')->nullable()->after('featured_image');
            $table->foreignId('featured_media_id')->nullable()->after('featured_image_alt')->constrained('curator_media')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('breeds', function (Blueprint $table) {
            $table->dropForeign(['featured_media_id']);
            $table->dropColumn(['featured_image', 'featured_image_alt', 'featured_media_id']);
        });
    }
};
