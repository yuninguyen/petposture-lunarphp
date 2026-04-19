<?php
header('Content-Type: text/plain');
try {
    $db = new PDO('sqlite:../database/database.sqlite');
    $stmt = $db->query("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'lunar_%'");
    $tables = $stmt->fetchAll(PDO::FETCH_COLUMN);
    echo "Lunar Tables Found (" . count($tables) . "):\n";
    echo implode("\n", $tables);
} catch (Exception $e) {
    echo "Error: " . $e->getMessage();
}
