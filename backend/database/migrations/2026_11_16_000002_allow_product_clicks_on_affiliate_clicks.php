<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

// A click on a Pick comes from a product page, not a blog post, so post_id becomes optional
// and the clicked product is recorded in product_id.
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('affiliate_clicks', function (Blueprint $table) {
            $table->foreignId('post_id')->nullable()->change();
            $table->foreignId('product_id')->nullable()->after('post_id')
                ->constrained('lunar_products')->nullOnDelete();
            $table->index(['product_id', 'created_at']);
        });
    }

    public function down(): void
    {
        // Clicks without a post cannot exist in the old shape.
        DB::table('affiliate_clicks')->whereNull('post_id')->delete();

        Schema::table('affiliate_clicks', function (Blueprint $table) {
            $table->dropIndex(['product_id', 'created_at']);
            $table->dropConstrainedForeignId('product_id');
            $table->foreignId('post_id')->nullable(false)->change();
        });
    }
};
