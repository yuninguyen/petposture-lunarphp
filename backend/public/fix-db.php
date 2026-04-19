<?php

require __DIR__ . '/../vendor/autoload.php';
$app = require_once __DIR__ . '/../bootstrap/app.php';

use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schema;

$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

echo "<h1>PetPosture DB Fixer v1.2</h1>";

try {
    Artisan::call('migrate', ['--force' => true]);
    echo "Migration output: <pre>" . Artisan::output() . "</pre>";
} catch (\Exception $e) {
    echo "Migration error: " . $e->getMessage() . "<br>";
}

echo "<h2>Verifying Tables</h2>";
$tables = ['posts', 'comments', 'reviews'];
foreach ($tables as $table) {
    if (Schema::hasTable($table)) {
        echo "<b style='color:green;'>SUCCESS: '$table' table exists!</b><br>";
    } else {
        echo "<b style='color:red;'>FAILURE: '$table' table is missing.</b><br>";
    }
}
