<?php
require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$products = \Lunar\Models\Product::all();
echo "Total Lunar Products: " . $products->count() . "\n";
foreach ($products as $p) {
    echo "Product ID: " . $p->id . ", Name: " . ($p->translate('attribute_data')['name']['en'] ?? 'N/A') . "\n";
    echo "Variants count: " . $p->variants()->count() . "\n";
}

$activeProducts = \Lunar\Models\Product::whereHas('variants')->get();
echo "Active Products (with variants): " . $activeProducts->count() . "\n";
