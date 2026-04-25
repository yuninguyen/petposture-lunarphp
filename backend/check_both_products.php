<?php
require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();
try {
    echo "App\Models\Product Count: " . \App\Models\Product::count() . "\n";
} catch (\Exception $e) {
    echo "App\Models\Product error: " . $e->getMessage() . "\n";
}
try {
    echo "Lunar\Models\Product Count: " . \Lunar\Models\Product::count() . "\n";
} catch (\Exception $e) {
    echo "Lunar\Models\Product error: " . $e->getMessage() . "\n";
}
