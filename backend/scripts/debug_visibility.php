<?php
require __DIR__ . '/../vendor/autoload.php';
$app = require_once __DIR__ . '/../bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use Lunar\Models\Product;
use Lunar\Models\Channel;
use Lunar\Models\CustomerGroup;

echo "--- Product Visibility Diagnostics ---\n";

$products = Product::all();
echo "Total Products: " . $products->count() . "\n\n";

foreach ($products as $product) {
    $name = $product->attr('name');
    echo "Product: {$name} (ID: {$product->id})\n";
    echo "  Status: {$product->status}\n";

    $channels = $product->channels;
    echo "  Channels (" . $channels->count() . "): " . $channels->pluck('name')->join(', ') . "\n";
    foreach ($channels as $channel) {
        $pivot = $channel->pivot;
        echo "    - {$channel->name}: enabled=" . ($pivot->enabled ? 'YES' : 'NO') . ", starts_at=" . ($pivot->starts_at ?? 'NULL') . "\n";
    }

    $groups = $product->customerGroups;
    echo "  Customer Groups (" . $groups->count() . "): " . $groups->pluck('name')->join(', ') . "\n";
    foreach ($groups as $group) {
        $pivot = $group->pivot;
        echo "    - {$group->name}: enabled=" . ($pivot->enabled ? 'YES' : 'NO') . ", starts_at=" . ($pivot->starts_at ?? 'NULL') . "\n";
    }

    $urls = $product->urls;
    echo "  URLs (" . $urls->count() . "): " . $urls->pluck('slug')->join(', ') . "\n";

    $variantsCount = $product->variants()->count();
    echo "  Variants: {$variantsCount}\n";

    echo "-----------------------------------\n";
}
