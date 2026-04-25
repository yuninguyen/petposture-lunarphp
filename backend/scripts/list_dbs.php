<?php
$host = '127.0.0.1';
$user = 'root';
$pass = '';

try {
    $pdo = new PDO("mysql:host=$host", $user, $pass);
    $dbs = $pdo->query("SHOW DATABASES")->fetchAll(PDO::FETCH_COLUMN);
    echo "DATABASES:\n";
    foreach ($dbs as $db) {
        echo "- $db\n";
    }
} catch (\PDOException $e) {
    echo "ERROR: " . $e->getMessage();
}
