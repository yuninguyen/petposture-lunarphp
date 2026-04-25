<?php
use Illuminate\Contracts\Console\Kernel;

require __DIR__ . '/../vendor/autoload.php';
$app = require_once __DIR__ . '/../bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;

// 1. Get all tables in MySQL
$tables = DB::select('SHOW TABLES');
$dbName = config('database.connections.mysql.database');
$tableNameKey = "Tables_in_" . $dbName;
$existingTables = array_map(fn($t) => $t->$tableNameKey, $tables);

echo "Existing Tables: " . count($existingTables) . "\n";

// 2. Get all migration files
$migrationFiles = File::files(database_path('migrations'));
$migrationNames = array_map(fn($f) => $f->getBasename('.php'), $migrationFiles);

// Get migrations already in the database
$ranMigrations = DB::table('migrations')->pluck('migration')->toArray();

// 3. Check for mismatches
foreach ($migrationNames as $name) {
    if (in_array($name, $ranMigrations))
        continue;

    // Check if the table this migration creates exists
    // We guess the table name from the migration filename (very crude)
    if (preg_match('/create_(.*)_table/', $name, $matches)) {
        $tableName = $matches[1];
        if (in_array($tableName, $existingTables)) {
            echo "MATCH FOUND: Migration $name creates table $tableName which ALREADY EXISTS. Inserting record into migrations table.\n";
            DB::table('migrations')->insert([
                'migration' => $name,
                'batch' => 1 // Just put them in batch 1
            ]);
        }
    }
}

echo "SYNC_COMPLETE\n";
