<?php

$db_path = __DIR__ . '/database/database.sqlite';
try {
    $pdo = new PDO('sqlite:' . $db_path);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    $sql = "CREATE TABLE IF NOT EXISTS reviews (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id INTEGER NOT NULL,
        customer_name TEXT NOT NULL,
        rating INTEGER NOT NULL,
        comment TEXT NOT NULL,
        is_verified INTEGER DEFAULT 0,
        created_at DATETIME,
        updated_at DATETIME,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    )";

    $pdo->exec($sql);
    echo "SUCCESS: reviews table created/verified." . PHP_EOL;

} catch (PDOException $e) {
    echo "ERROR: " . $e->getMessage() . PHP_EOL;
}
