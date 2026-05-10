<?php
require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use Lunar\Models\Product;

$out = "ID | NAME | STATUS | PRODUCT_TYPE_ID | ATTR_COUNT\n";
foreach (Product::all() as $p) {
    $name = $p->translateAttribute('name') ?: 'N/A';
    $attrCount = count($p->attribute_data);
    $out .= "{$p->id} | {$name} | {$p->status} | {$p->product_type_id} | {$attrCount}\n";
}

file_put_contents('lunar_dump.txt', $out);
echo "Dumped to lunar_dump.txt\n";
