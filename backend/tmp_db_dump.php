<?php
try {
    $pdo = new PDO("mysql:host=127.0.0.1;dbname=petposture_lunar", "root", "");
    $stmt = $pdo->query("SELECT id, sku FROM lunar_product_variants");
    $variants = $stmt->fetchAll(PDO::FETCH_ASSOC);
    echo json_encode($variants);
} catch (PDOException $e) {
    echo "Error: " . $e->getMessage();
}
