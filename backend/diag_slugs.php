<?php
require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use Lunar\Models\Product;

$products = Product::all();
foreach ($products as $p) {
    echo "ID: {$p->id}, Slug: " . $p->defaultUrl?->slug . "\n";
}
