<?php
require 'vendor/autoload.php';
$app = require_once 'bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use Illuminate\Support\Facades\DB;

$tables = DB::select('SHOW TABLES');
$tableKey = 'Tables_in_' . env('DB_DATABASE');

foreach ($tables as $table) {
    $tableName = $table->$tableKey;
    // Check if the table has columns
    try {
        $columns = Schema::getColumnListing($tableName);
        foreach ($columns as $column) {
            $results = DB::table($tableName)
                ->where(DB::raw("CAST(`$column` AS CHAR)"), 'LIKE', '%petposture.com%')
                ->get();
            if ($results->count() > 0) {
                echo "Table: $tableName, Column: $column, Count: " . $results->count() . "\n";
                foreach ($results as $row) {
                    echo "  Row: " . json_encode($row) . "\n";
                }
            }
        }
    } catch (\Exception $e) {
        // Skip
    }
}
