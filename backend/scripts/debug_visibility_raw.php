<?php
// Bypass Laravel bootstrap to avoid hang
$host = '127.0.0.1';
$db = 'petposture';
$user = 'root';
$pass = ''; // Default for Laragon
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

echo "--- RAW SQL Visibility Diagnostics ---\n";

$prodCount = $pdo->query("SELECT COUNT(*) FROM lunar_products")->fetchColumn();
echo "Total Products in lunar_products: " . $prodCount . "\n\n";

$products = $pdo->query("SELECT id, status, attribute_data FROM lunar_products")->fetchAll();

foreach ($products as $product) {
    $attr = json_decode($product['attribute_data'], true);
    $name = $attr['name']['value'] ?? 'Unknown';
    echo "Product: {$name} (ID: {$product['id']})\n";
    echo "  Status: {$product['status']}\n";

    // Channels
    $channels = $pdo->query("SELECT pc.*, c.name FROM lunar_channel_product pc JOIN lunar_channels c ON pc.channel_id = c.id WHERE pc.product_id = {$product['id']}")->fetchAll();
    echo "  Channels (" . count($channels) . "):\n";
    foreach ($channels as $c) {
        echo "    - {$c['name']}: enabled=" . ($c['enabled'] ? 'YES' : 'NO') . ", starts_at=" . ($c['starts_at'] ?? 'NULL') . "\n";
    }

    // Customer Groups
    $groups = $pdo->query("SELECT pg.*, g.name FROM lunar_customer_group_product pg JOIN lunar_customer_groups g ON pg.customer_group_id = g.id WHERE pg.product_id = {$product['id']}")->fetchAll();
    echo "  Customer Groups (" . count($groups) . "):\n";
    foreach ($groups as $g) {
        echo "    - {$g['name']}: enabled=" . ($g['enabled'] ? 'YES' : 'NO') . ", starts_at=" . ($g['starts_at'] ?? 'NULL') . "\n";
    }

    // URLs
    $urls = $pdo->query("SELECT slug FROM lunar_urls WHERE element_type LIKE '%Product' AND element_id = {$product['id']}")->fetchAll();
    echo "  URLs: " . implode(', ', array_column($urls, 'slug')) . "\n";

    echo "-----------------------------------\n";
}
