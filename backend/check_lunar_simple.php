<?php
require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

echo "Total Lunar Products: " . \Lunar\Models\Product::count() . "\n";
echo "Active Products (with variants): " . \Lunar\Models\Product::whereHas('variants')->count() . "\n";
