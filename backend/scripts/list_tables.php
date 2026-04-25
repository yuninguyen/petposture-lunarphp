<?php
$host = '127.0.0.1';
$db = 'petposture_lunar';
$user = 'root';
$pass = '';

try {
    $pdo = new PDO("mysql:host=$host;dbname=$db", $user, $pass);
    $tables = $pdo->query("SHOW TABLES")->fetchAll(PDO::FETCH_COLUMN);
    echo "TABLES in $db:\n";
    foreach ($tables as $table) {
        echo "- $table\n";
    }
} catch (\PDOException $e) {
    echo "ERROR: " . $e->getMessage();
}
