<?php
use Illuminate\Contracts\Console\Kernel;

require __DIR__ . '/../vendor/autoload.php';
$app = require_once __DIR__ . '/../bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();

echo "CHANNELS: " . \Lunar\Models\Channel::count() . "\n";
echo "CURRENCIES: " . \Lunar\Models\Currency::count() . "\n";
echo "PRODUCT_TYPES: " . \Lunar\Models\ProductType::count() . "\n";

foreach (\Lunar\Models\Currency::all() as $currency) {
    echo "CURRENCY: " . $currency->code . " (Default: " . ($currency->default ? 'YES' : 'NO') . ")\n";
}

foreach (\Lunar\Models\Channel::all() as $channel) {
    echo "CHANNEL: " . $channel->handle . " (Default: " . ($channel->default ? 'YES' : 'NO') . ")\n";
}
