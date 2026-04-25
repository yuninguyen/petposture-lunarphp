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
    try {
        $out .= "ID: {$p->id}, Name: " . $p->translateAttribute('name') . ", Slug: " . ($p->defaultUrl?->slug ?? 'N/A') . "\n";
    } catch (\Exception $e) {
        $out .= "ID: {$p->id}, Error: " . $e->getMessage() . "\n";
    }
}

$out .= "\n--- LEGACY PRODUCTS ---\n";
foreach (DB::table('products')->get() as $p) {
    $out .= "ID: {$p->id}, Name: {$p->name}, Slug: {$p->slug}\n";
}

file_put_contents('C:\Users\YUNI-SS980\.gemini\antigravity\brain\2fde66e5-af49-47d2-9c0a-85f6705a1da3\audit_final_absolute.txt', $out);
echo "Written to absolute path.\n";
