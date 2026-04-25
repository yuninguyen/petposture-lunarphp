<?php
require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use Lunar\Models\Product;
use Lunar\Models\Url as LunarUrl;
use Lunar\FieldTypes\Text;
use Illuminate\Support\Facades\DB;

$id = 7;
$correctName = "Premium Grain-Free Salmon Cat Food";
$correctSlug = "premium-grain-free-salmon-cat-food";

echo "Surgical Fix for ID $id...\n";

// 1. Lunar URL
DB::table('lunar_urls')
    ->where('element_type', Product::class)
    ->where('element_id', $id)
    ->update(['slug' => $correctSlug]);
echo "  URL slug updated to: $correctSlug\n";

// 2. Lunar Product Attribute Data
$product = Product::find($id);
if ($product) {
    $attrData = $product->attribute_data;
    $attrData['name'] = new Text($correctName);
    $product->attribute_data = $attrData;
    $product->save();
    echo "  Product name updated in attribute_data.\n";
}

// 3. Legacy Table
DB::table('products')
    ->where('id', $id)
    ->update([
        'name' => $correctName,
        'slug' => $correctSlug
    ]);
echo "  Legacy table updated.\n";
