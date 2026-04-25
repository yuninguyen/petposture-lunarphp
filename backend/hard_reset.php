<?php
require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use Lunar\Models\Product;
use Lunar\Models\Url as LunarUrl;
use Database\Seeders\ProductMigrationSeeder;
use Illuminate\Support\Facades\DB;

echo "Hard Resetting Products...\n";

// 1. Wipe all product-related data in Lunar to avoid ID mismatches and corruption
DB::statement('SET FOREIGN_KEY_CHECKS=0;');
DB::table('lunar_urls')->where('element_type', Product::class)->delete();
DB::table('lunar_products')->delete();
DB::table('lunar_product_variants')->delete();
DB::table('lunar_prices')->where('priceable_type', \Lunar\Models\ProductVariant::class)->delete();
DB::table('lunar_collection_product')->delete();
DB::statement('SET FOREIGN_KEY_CHECKS=1;');
echo "Lunar products wiped.\n";

// 2. Re-run Seeder
// I've already fixed the legacy 'products' table in previous steps.
(new ProductMigrationSeeder())->run();
echo "Re-migrated everything.\n";
