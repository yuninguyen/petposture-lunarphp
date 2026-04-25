<?php
try {
    $pdo = new PDO("mysql:host=127.0.0.1;dbname=petposture_lunar", "root", "");
    $stmt = $pdo->prepare("SELECT * FROM lunar_discounts WHERE coupon = ?");
    $stmt->execute(['CJIY8CGV']);
    $discount = $stmt->fetch(PDO::FETCH_ASSOC);
    echo json_encode($discount);
} catch (PDOException $e) {
    echo "Error: " . $e->getMessage();
}
