<?php

require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

$tables = DB::select('SHOW TABLES LIKE "lunar_%"');
foreach ($tables as $table) {
    echo array_values((array) $table)[0] . PHP_EOL;
}
