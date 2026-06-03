<?php
require 'vendor/autoload.php';
$app = require_once 'bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

echo "app.url: " . config('app.url') . "\n";
echo "app.env: " . config('app.env') . "\n";
