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

echo "--- FIXING VISIBILITY ---\n";

$products = $pdo->query("SELECT id FROM lunar_products")->fetchAll();
$channelId = 1; // Default
$groupId = 1; // Default

foreach ($products as $p) {
    echo "Processing Product ID: {$p['id']}\n";

    // Channel check/insert
    $exists = $pdo->query("SELECT 1 FROM lunar_channel_product WHERE product_id = {$p['id']} AND channel_id = $channelId")->fetch();
    if (!$exists) {
        $pdo->prepare("INSERT INTO lunar_channel_product (product_id, channel_id, enabled, starts_at) VALUES (?, ?, 1, NOW())")
            ->execute([$p['id'], $channelId]);
        echo "  - Link added to Channel $channelId\n";
    } else {
        $pdo->prepare("UPDATE lunar_channel_product SET enabled = 1 WHERE product_id = ? AND channel_id = ?")
            ->execute([$p['id'], $channelId]);
        echo "  - Channel link enabled\n";
    }

    // Group check/insert
    $exists = $pdo->query("SELECT 1 FROM lunar_customer_group_product WHERE product_id = {$p['id']} AND customer_group_id = $groupId")->fetch();
    if (!$exists) {
        $pdo->prepare("INSERT INTO lunar_customer_group_product (product_id, customer_group_id, enabled, starts_at) VALUES (?, ?, 1, NOW())")
            ->execute([$p['id'], $groupId]);
        echo "  - Link added to Group $groupId\n";
    } else {
        $pdo->prepare("UPDATE lunar_customer_group_product SET enabled = 1 WHERE product_id = ? AND customer_group_id = ?")
            ->execute([$p['id'], $groupId]);
        echo "  - Group link enabled\n";
    }

    // Ensure status is published
    $pdo->prepare("UPDATE lunar_products SET status = 'published' WHERE id = ?")
        ->execute([$p['id']]);
    echo "  - Status updated to published\n";
}

echo "DONE.\n";
