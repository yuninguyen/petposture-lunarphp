<?php
require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use Illuminate\Support\Facades\DB;

$id = 7;
$correctName = "Premium Grain-Free Salmon Cat Food";
$correctSlug = "premium-grain-free-salmon-cat-food";

echo "Manually fixing legacy ID $id...\n";
DB::table('products')->where('id', $id)->update([
    'name' => $correctName,
    'slug' => $correctSlug
]);

// Double check
$p = DB::table('products')->find($id);
if ($p) {
    echo "VERIFIED Legacy ID $id Name: {$p->name}, Slug: {$p->slug}\n";
} else {
    echo "Legacy ID $id NOT FOUND!\n";
    // Search by name
    $all = DB::table('products')->where('name', 'like', '%Salmon%')->get();
    echo "Found " . $all->count() . " products with Salmon in name.\n";
    foreach ($all as $item) {
        echo "ID: {$item->id}, Name: {$item->name}\n";
    }
}
