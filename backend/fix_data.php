<?php
require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use Lunar\Models\Product;
use Lunar\Models\Url as LunarUrl;
use Lunar\FieldTypes\Text;

// 1. Fix Product ID 7 (The one with mangled name/slug)
$product = Product::find(7);
if ($product) {
    echo "Fixing Product ID 7...\n";

    // Fix Name
    $attr = $product->attribute_data;
    $attr['name'] = new Text("Premium Grain-Free Salmon Cat Food");
    $product->attribute_data = $attr;
    $product->save();
    echo "  Name fixed.\n";

    // Fix Slug in lunar_urls
    $url = LunarUrl::where('element_type', Product::class)
        ->where('element_id', 7)
        ->first();
    if ($url) {
        $url->update(['slug' => 'premium-grain-free-salmon-cat-food']);
        echo "  Slug fixed: premium-grain-free-salmon-cat-food\n";
    }
} else {
    echo "Product ID 7 not found.\n";
}

// 2. Fix legacy products table too (to prevent re-migration issues)
\Illuminate\Support\Facades\DB::table('products')
    ->where('id', 7)
    ->update([
        'name' => 'Premium Grain-Free Salmon Cat Food',
        'slug' => 'premium-grain-free-salmon-cat-food'
    ]);
echo "Legacy table fixed.\n";
