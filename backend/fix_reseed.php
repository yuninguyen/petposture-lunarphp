<?php
require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use Lunar\Models\Product;
use Lunar\Models\Url as LunarUrl;
use Database\Seeders\ProductMigrationSeeder;

$id = 7;
echo "Purging and Re-seeding Product ID $id...\n";

// 1. Delete from Lunar
$product = Product::find($id);
if ($product) {
    // Delete URLs
    LunarUrl::where('element_type', Product::class)
        ->where('element_id', $id)
        ->delete();

    // Delete Variants & Prices (cascades usually, but let's be safe)
    foreach ($product->variants as $v) {
        $v->prices()->delete();
        $v->delete();
    }

    $product->collections()->detach();
    $product->delete();
    echo "  Purged from Lunar.\n";
}

// 2. Re-run Seeder for all products (it checks for existence)
// Since legacy ID 7 was just fixed in DB by previous command, this should create it clean.
(new ProductMigrationSeeder())->run();
echo "  Migration seeder re-run.\n";
