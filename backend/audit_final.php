<?php
require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use Lunar\Models\Product as LunarProduct;
use Illuminate\Support\Facades\DB;

$out = "";
$out .= "--- LUNAR PRODUCTS ---\n";
foreach (LunarProduct::all() as $p) {
    $out .= "ID: {$p->id}, Name: " . $p->translateAttribute('name') . ", Slug: " . ($p->defaultUrl?->slug ?? 'N/A') . "\n";
}

$out .= "\n--- LEGACY PRODUCTS ---\n";
foreach (DB::table('products')->get() as $p) {
    $out .= "ID: {$p->id}, Name: {$p->name}, Slug: {$p->slug}\n";
}

file_put_contents('audit_final.txt', $out);
echo "Audit written to audit_final.txt\n";
