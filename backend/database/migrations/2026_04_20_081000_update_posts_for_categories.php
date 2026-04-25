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
        Schema::table('posts', function (Blueprint $table) {
            if (!Schema::hasColumn('posts', 'category_id')) {
                $table->foreignId('category_id')->after('id')->nullable()->constrained('categories')->onDelete('set null');
            }
            if (!Schema::hasColumn('posts', 'author')) {
                $table->string('author')->after('content')->nullable();
            }
            if (!Schema::hasColumn('posts', 'read_time')) {
                $table->string('read_time')->after('author')->nullable();
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('posts', function (Blueprint $table) {
            $table->dropForeign(['category_id']);
            $table->dropColumn(['category_id', 'author', 'read_time']);
        });
    }
};
