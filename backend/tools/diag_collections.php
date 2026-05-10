<?php
require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use Lunar\Models\Product;
use Lunar\Models\Collection;

$products = Product::all();
foreach ($products as $product) {
    echo "Product: " . $product->translateAttribute('name') . " (ID: {$product->id})\n";
    echo "  Collections: " . $product->collections->map(fn($c) => $c->translateAttribute('name') . " (Slug: " . $c->defaultUrl?->slug . ")")->join(', ') . "\n";
}
