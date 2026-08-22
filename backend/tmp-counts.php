<?php

require 'vendor/autoload.php';

$app = require 'bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

echo 'breeds='.App\Models\Breed::count().PHP_EOL;
echo 'solutions='.App\Models\Solution::count().PHP_EOL;
echo 'tags='.App\Models\BlogTag::count().PHP_EOL;
echo 'networks='.App\Models\AffiliateNetwork::count().PHP_EOL;
echo 'categories='.App\Models\BlogCategory::count().PHP_EOL;
