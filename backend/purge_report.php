<?php
require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use Lunar\Models\Product;

$count = Product::count();
$ids = Product::pluck('id')->toArray();
$out = "Product Count: $count\nID List: " . implode(', ', $ids) . "\n";

file_put_contents('purge_report.txt', $out);
echo "Report generated.\n";
