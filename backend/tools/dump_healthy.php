<?php
require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use Lunar\Models\Product;

$p = Product::find(5); // Admin says ID 5 is healthy
if ($p) {
    file_put_contents('C:\Users\YUNI-SS980\.gemini\antigravity\brain\2fde66e5-af49-47d2-9c0a-85f6705a1da3\healthy_structure.json', $p->attribute_data->toJson());
    echo "Dumped healthy ID 5 structure.\n";
} else {
    // Try find ANY product and dump it
    $p = Product::first();
    if ($p) {
        file_put_contents('C:\Users\YUNI-SS980\.gemini\antigravity\brain\2fde66e5-af49-47d2-9c0a-85f6705a1da3\healthy_structure.json', $p->attribute_data->toJson());
        echo "Dumped first product structure.\n";
    } else {
        echo "No products found in Lunar.\n";
    }
}
