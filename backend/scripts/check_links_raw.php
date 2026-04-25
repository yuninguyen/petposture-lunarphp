<?php
$host = '127.0.0.1';
$db = 'petposture';
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
} catch (\PDOException $e) {
    throw new \PDOException($e->getMessage(), (int) $e->getCode());
}

echo "--- CHANNELS ---\n";
$channels = $pdo->query("SELECT * FROM lunar_channels")->fetchAll();
foreach ($channels as $c) {
    echo "ID: {$c['id']}, Name: {$c['name']}, Handle: {$c['handle']}, Default: {$c['default']}\n";
}

echo "\n--- CUSTOMER GROUPS ---\n";
$groups = $pdo->query("SELECT * FROM lunar_customer_groups")->fetchAll();
foreach ($groups as $g) {
    echo "ID: {$g['id']}, Name: {$g['name']}, Handle: {$g['handle']}, Default: {$g['default']}\n";
}

echo "\n--- CHANNEL PRODUCT LINKS ---\n";
$links = $pdo->query("SELECT product_id, channel_id, enabled FROM lunar_channel_product")->fetchAll();
echo "Count: " . count($links) . "\n";
foreach ($links as $l) {
    echo "Product ID: {$l['product_id']}, Channel ID: {$l['channel_id']}, Enabled: {$l['enabled']}\n";
}
