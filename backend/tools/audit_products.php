<?php
require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use Lunar\Models\Product as LunarProduct;
use Illuminate\Support\Facades\DB;

echo "--- LUNAR PRODUCTS ---\n";
foreach (LunarProduct::all() as $p) {
    echo "ID: {$p->id}, Name: " . $p->translateAttribute('name') . "\n";
}

echo "\n--- LEGACY PRODUCTS ---\n";
foreach (DB::table('products')->get() as $p) {
    echo "ID: {$p->id}, Name: {$p->name}\n";
}
