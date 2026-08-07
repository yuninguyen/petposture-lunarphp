<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('media_folders', function (Blueprint $table) {
            $table->boolean('starred')->default(false)->after('slug');
        });
    }

    public function down(): void
    {
        Schema::table('media_folders', function (Blueprint $table) {
            $table->dropColumn('starred');
        });
    }
};
