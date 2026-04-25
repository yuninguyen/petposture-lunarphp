<?php
require __DIR__ . '/../vendor/autoload.php';
$app = require_once __DIR__ . '/../bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use Lunar\Models\Product;
use Lunar\Models\ProductVariant;
use Lunar\Models\Price;
use Lunar\Models\Currency;
use Lunar\Models\TaxClass;
use Lunar\Models\ProductType;
use Lunar\Models\Url;
use Lunar\Models\Channel;
use Lunar\Models\CustomerGroup;
use App\Models\Category;
use Illuminate\Support\Str;

echo "--- Seeding Diagnostics ---\n";

try {
    $pt = ProductType::first();
    if (!$pt) {
        echo "Creating ProductType...\n";
        $pt = ProductType::create(['name' => 'General']);
    }
    echo "ProductType ID: " . $pt->id . "\n";

    $currency = Currency::getDefault() ?? Currency::whereDefault(true)->first();
    echo "Currency: " . ($currency?->code ?? 'NONE') . "\n";

    $taxClass = TaxClass::first() ?? TaxClass::create(['name' => 'Default']);
    echo "TaxClass ID: " . $taxClass->id . "\n";

    $channel = Channel::first();
    echo "Channel ID: " . ($channel?->id ?? 'NONE') . "\n";

    $customerGroup = CustomerGroup::first();
    echo "CustomerGroup ID: " . ($customerGroup?->id ?? 'NONE') . "\n";

    $category = Category::first();
    echo "Category ID: " . ($category?->id ?? 'NONE') . "\n";

    if (!$currency || !$pt || !$taxClass || !$channel || !$customerGroup || !$category) {
        echo "ERROR: Missing required base data (Currency/PT/TaxClass/Channel/CG/Category)\n";
        exit(1);
    }

    echo "Attempting to create ONE product...\n";

    $name = "Diagnostic Product " . time();
    $sku = "DIAG-" . time();

    $product = Product::create([
        'product_type_id' => $pt->id,
        'category_id' => $category->id,
        'attribute_data' => [
            'name' => new \Lunar\FieldTypes\Text($name),
            'description' => new \Lunar\FieldTypes\Text("Description for " . $name),
        ],
        'status' => 'published',
    ]);

    echo "Product created: ID " . $product->id . "\n";

    $product->channels()->syncWithPivotValues([$channel->id], [
        'enabled' => true,
        'starts_at' => now(),
    ]);

    $product->customerGroups()->syncWithPivotValues([$customerGroup->id], [
        'enabled' => true,
        'starts_at' => now(),
    ]);

    echo "Channels/CG synced.\n";

    $variant = ProductVariant::create([
        'product_id' => $product->id,
        'sku' => $sku,
        'stock' => 10,
        'shippable' => true,
        'tax_class_id' => $taxClass->id,
    ]);

    echo "Variant created: ID " . $variant->id . "\n";

    Price::create([
        'priceable_type' => ProductVariant::class,
        'priceable_id' => $variant->id,
        'currency_id' => $currency->id,
        'price' => 1000,
        'tier' => 1,
    ]);

    echo "Price created.\n";

    Url::create([
        'language_id' => 1,
        'element_type' => Product::class,
        'element_id' => $product->id,
        'slug' => Str::slug($name),
        'default' => true,
    ]);

    echo "URL created.\n";
    echo "SUCCESS!\n";

} catch (\Exception $e) {
    echo "EXCEPTION: " . $e->getMessage() . "\n";
    echo "TRACE:\n" . $e->getTraceAsString() . "\n";
}
