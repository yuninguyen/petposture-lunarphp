<?php
require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use Illuminate\Support\Facades\DB;

$products = DB::table('lunar_products')->get();
$out = "ID | Attribute Data JSON\n";
$out .= "-----------------------\n";
foreach ($products as $p) {
    $out .= "ID: {$p->id} | DATA: {$p->attribute_data}\n";
}

file_put_contents('debug_db_json.txt', $out);
echo "Raw DB Dump complete. Check debug_db_json.txt\n";
