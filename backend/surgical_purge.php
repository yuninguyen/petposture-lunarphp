<?php
require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use Lunar\Models\Product;
use Lunar\Models\ProductVariant;
use Lunar\Models\Url;
use Lunar\Models\Price;

echo "Surgical Purge Starting...\n";

// We only want products 1-6 (as seen in Admin)
$allowedIds = [1, 2, 3, 4, 5, 6];

$allProducts = Product::all();
foreach ($allProducts as $p) {
    if (!in_array($p->id, $allowedIds)) {
        echo "Deleting Orphaned/Corrupted Product ID: {$p->id} ({$p->translateAttribute('name')})\n";

        // Cleanup related data
        Url::where('element_type', Product::class)->where('element_id', $p->id)->delete();
        $variants = ProductVariant::where('product_id', $p->id)->get();
        foreach ($variants as $v) {
            Price::where('priceable_type', ProductVariant::class)->where('priceable_id', $v->id)->delete();
            $v->delete();
        }
        $p->collections()->detach();
        $p->delete();
    } else {
        echo "Keeping Healthy Product ID: {$p->id} ({$p->translateAttribute('name')})\n";
    }
}

// Final check: ensure ID 5 (Salmon) is correct
$salmon = Product::find(5);
if ($salmon) {
    $name = "Premium Grain-Free Salmon Cat Food";
    $slug = "premium-grain-free-salmon-cat-food";

    // Fix attributes if needed
    $attr = $salmon->attribute_data;
    $attr['name'] = new \Lunar\FieldTypes\Text($name);
    $salmon->attribute_data = $attr;
    $salmon->save();

    // Fix URL
    Url::where('element_type', Product::class)
        ->where('element_id', $salmon->id)
        ->update(['slug' => $slug]);

    echo "Verified and Corrected Salmon Product (ID 5).\n";
}

echo "Surgical Purge Complete.\n";
