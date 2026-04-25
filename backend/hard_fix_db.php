<?php
// Simple standalone DB patch
$host = '127.0.0.1';
$db = 'petposture_lunar';
$user = 'root';
$pass = '';
$charset = 'utf8mb4';

$dsn = "mysql:host=$host;dbname=$db;charset=$charset";
$options = [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    PDO::ATTR_EMULATE_PREPARES => false,
];

try {
    $pdo = new PDO($dsn, $user, $pass, $options);
    echo "Connection success. Patching table 'orders'...\n";

    // Check and add email
    try {
        $pdo->exec("ALTER TABLE orders ADD COLUMN email VARCHAR(255) AFTER user_id");
        echo "Column 'email' added.\n";
    } catch (Exception $e) {
        echo "Column 'email' already exists or error: " . $e->getMessage() . "\n";
    }

    // Check and add tracking_number
    try {
        $pdo->exec("ALTER TABLE orders ADD COLUMN tracking_number VARCHAR(255) AFTER shipping_address");
        echo "Column 'tracking_number' added.\n";
    } catch (Exception $e) {
        echo "Column 'tracking_number' already exists or error: " . $e->getMessage() . "\n";
    }

    // Add unique index
    try {
        $pdo->exec("CREATE UNIQUE INDEX tracking_number_unique ON orders(tracking_number)");
        echo "Index 'tracking_number_unique' added.\n";
    } catch (Exception $e) {
        echo "Index already exists or error: " . $e->getMessage() . "\n";
    }

    echo "SUCCESS: Database patch applied.\n";

} catch (\PDOException $e) {
    echo "CRITICAL ERROR: " . $e->getMessage() . "\n";
}
