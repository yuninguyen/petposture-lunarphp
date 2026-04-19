<?php

require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';

use Illuminate\Support\Facades\Schema;

$app->make(\Illuminate\Contracts\Console\Kernel::class)->bootstrap();

$tables = Schema::getAllTables();
$output = "";
foreach ($tables as $table) {
    $output .= $table->name . PHP_EOL;
}

if (Schema::hasTable('reviews')) {
    $output .= "SUCCESS: reviews table exists." . PHP_EOL;
} else {
    $output .= "FAILURE: reviews table does not exist." . PHP_EOL;
}

file_put_contents('table_list.txt', $output);
echo "Done.";
