<?php
require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$p = \DB::table('lunar_products')->where('id', 5)->first();
if ($p) {
    file_put_contents('golden_attribute.txt', $p->attribute_data);
    echo "Dumped Product ID 5 attribute_data.\n";
} else {
    echo "Product ID 5 not found.\n";
}
