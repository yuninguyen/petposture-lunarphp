<?php
require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use Lunar\Models\Product as LunarProduct;
use Lunar\Models\Url as LunarUrl;
use Lunar\FieldTypes\Text;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Artisan;

echo "Starting Super Fix...\n";

$correctName = "Premium Grain-Free Salmon Cat Food";
$correctSlug = "premium-grain-free-salmon-cat-food";

// 1. Fix Legacy Table
DB::table('products')->where('slug', 'like', '%salpremium%')->update([
    'name' => $correctName,
    'slug' => $correctSlug
]);
echo "Legacy table updated.\n";

// 2. Fix Lunar Table (Attribute Data)
$lunarProducts = LunarProduct::all();
foreach ($lunarProducts as $p) {
    if (strpos($p->translateAttribute('name'), 'SalPremium') !== false) {
        $attr = $p->attribute_data;
        $attr['name'] = new Text($correctName);
        $p->attribute_data = $attr;
        $p->save();
        echo "Lunar Product ID {$p->id} Name updated.\n";

        // Fix Slug
        LunarUrl::where('element_type', LunarProduct::class)
            ->where('element_id', $p->id)
            ->update(['slug' => $correctSlug]);
        echo "Lunar Product ID {$p->id} Slug updated.\n";
    }
}

// 3. Clear Caches
Artisan::call('cache:clear');
Artisan::call('config:clear');
Artisan::call('route:clear');
echo "Caches cleared.\n";

echo "Super Fix Complete.\n";
