<?php
try {
    $db = new PDO('sqlite:../database/database.sqlite');
    $stmt = $db->query("SELECT count(*) FROM migrations");
    echo "Migration Count: " . $stmt->fetchColumn() . "\n";

    $stmt = $db->query("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'lunar_%'");
    $tables = $stmt->fetchAll(PDO::FETCH_COLUMN);
    echo "Lunar Tables (" . count($tables) . "):\n";
    foreach ($tables as $t)
        echo "- $t\n";

} catch (Exception $e) {
    echo "Error: " . $e->getMessage();
}
