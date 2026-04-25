<?php
require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use Lunar\Models\Product;
use Illuminate\Support\Facades\DB;

$out = "Database: " . DB::connection()->getDatabaseName() . "\n";
$out .= "Default Connection: " . DB::getDefaultConnection() . "\n";
$out .= "Product Count: " . Product::count() . "\n";
$p7 = Product::find(7);
$out .= "Product 7 Exists: " . ($p7 ? 'YES' : 'NO') . "\n";
if ($p7) {
    $out .= "Product 7 Name: " . $p7->translateAttribute('name') . "\n";
}

file_put_contents('final_check_output.txt', $out);
echo "Check complete.\n";
