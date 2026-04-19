<?php
header('Content-Type: text/plain');
$dbFile = __DIR__ . '/../database/lunar_new.sqlite';
echo "Checking Database: $dbFile\n";
if (!file_exists($dbFile)) {
    echo "File not found!\n";
    exit;
}

try {
    $db = new PDO("sqlite:$dbFile");
    $stmt = $db->query("SELECT name FROM sqlite_master WHERE type='table'");
    $tables = $stmt->fetchAll(PDO::FETCH_COLUMN);
    echo "Total Tables Found: " . count($tables) . "\n";
    foreach ($tables as $table) {
        if (str_starts_with($table, 'lunar_')) {
            echo "[LUNAR] $table\n";
        } else {
            echo "        $table\n";
        }
    }
} catch (Exception $e) {
    echo "Error: " . $e->getMessage();
}
