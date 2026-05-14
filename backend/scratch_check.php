<?php
require 'vendor/autoload.php';
$app = require_once 'bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();
echo 'Orders: ' . \Lunar\Models\Order::count() . PHP_EOL;
echo 'Products: ' . \Lunar\Models\Product::count() . PHP_EOL;
