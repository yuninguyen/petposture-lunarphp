<?php
require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use Lunar\Models\Product;
use Lunar\FieldTypes\Text;

$p = Product::find(7);
if ($p) {
    echo "Current Name: " . $p->translateAttribute('name') . "\n";
    $attr = $p->attribute_data;
    $attr['name'] = new Text("Premium Grain-Free Salmon Cat Food");
    $p->attribute_data = $attr;
    $p->save();

    $p2 = Product::find(7);
    echo "New Name: " . $p2->translateAttribute('name') . "\n";
} else {
    echo "Product 7 not found\n";
}
