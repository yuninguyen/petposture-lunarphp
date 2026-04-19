<?php

require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';

use Illuminate\Support\Facades\Schema;

$app->make(\Illuminate\Contracts\Console\Kernel::class)->bootstrap();

$tables = Schema::getAllTables();
foreach ($tables as $table) {
    echo $table->name . PHP_EOL;
}

if (Schema::hasTable('reviews')) {
    echo "SUCCESS: reviews table exists." . PHP_EOL;
} else {
    echo "FAILURE: reviews table does not exist." . PHP_EOL;
}
