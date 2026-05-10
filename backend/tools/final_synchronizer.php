<?php
require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use Illuminate\Support\Facades\DB;
use Lunar\FieldTypes\Text;
use Lunar\Models\Product;
use Lunar\Models\ProductType;
use Lunar\Models\ProductVariant;
use Lunar\Models\Url;
use Lunar\Models\Price;
use Lunar\Models\Currency;
use Lunar\Models\TaxClass;

echo "Unified Sync Starting...\n";

// 1. Truncate Lunar Product Tables
DB::statement('SET FOREIGN_KEY_CHECKS=0;');
DB::table('lunar_products')->truncate();
DB::table('lunar_product_variants')->truncate();
DB::table('lunar_prices')->truncate();
DB::table('lunar_urls')->truncate();
DB::statement('SET FOREIGN_KEY_CHECKS=1;');

$productType = ProductType::first() ?? ProductType::create(['name' => 'General']);
$currency = Currency::where('code', 'USD')->first() ?? Currency::create(['code' => 'USD', 'name' => 'US Dollar', 'exchange_rate' => 1, 'decimal_places' => 2, 'default' => true]);
$taxClass = TaxClass::first() ?? TaxClass::create(['name' => 'Default']);

// 2. Fetch Legacy Products
$legacyProducts = DB::table('products')->get();

foreach ($legacyProducts as $lp) {
    echo "Syncing ID {$lp->id}: {$lp->name}\n";

    // Use INSERT to preserve ID
    DB::table('lunar_products')->insert([
        'id' => $lp->id,
        'product_type_id' => $productType->id,
        'status' => 'published',
        'attribute_data' => json_encode([
            'name' => ['en' => $lp->name],
            'description' => ['en' => $lp->description ?? ''],
        ]),
        'created_at' => $lp->created_at,
        'updated_at' => now(),
    ]);

    // Create Variant
    $variant = ProductVariant::create([
        'product_id' => $lp->id,
        'sku' => 'SKU-' . $lp->id,
        'stock' => $lp->stock_quantity ?? 100,
        'tax_class_id' => $taxClass->id,
        'unit_quantity' => 1,
    ]);

    // Create Price
    Price::create([
        'priceable_type' => ProductVariant::class,
        'priceable_id' => $variant->id,
        'currency_id' => $currency->id,
        'price' => (int) (($lp->price ?? 10.00) * 100), // Lunar stores as integers (cents)
    ]);

    // Create URL
    Url::create([
        'element_type' => Product::class,
        'element_id' => $lp->id,
        'slug' => \Illuminate\Support\Str::slug($lp->name),
        'default' => true,
        'language_id' => 1, // Assuming English
    ]);
}

echo "Unified Sync Complete. Total Products: " . Product::count() . "\n";
