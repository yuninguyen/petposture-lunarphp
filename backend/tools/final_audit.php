<?php
require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use Lunar\Models\Product as LunarProduct;
use Illuminate\Support\Facades\DB;

$out = "=== AUDIT REPORT ===\n\n";

$lunarCount = LunarProduct::count();
$legacyCount = DB::table('products')->count();

$out .= "LUNAR (lunar_products) COUNT: $lunarCount\n";
$out .= "LEGACY (products) COUNT: $legacyCount\n\n";

$out .= "--- LUNAR PRODUCTS (ID | Name | Status) ---\n";
foreach (LunarProduct::all() as $p) {
    $out .= "ID: {$p->id} | Name: " . ($p->translateAttribute('name') ?? 'N/A') . " | Status: {$p->status}\n";
}

$out .= "\n--- LEGACY PRODUCTS (ID | Name) ---\n";
foreach (DB::table('products')->get() as $p) {
    $out .= "ID: {$p->id} | Name: {$p->name}\n";
}

file_put_contents('audit_comparison.txt', $out);
echo "Audit complete. Result in audit_comparison.txt\n";
