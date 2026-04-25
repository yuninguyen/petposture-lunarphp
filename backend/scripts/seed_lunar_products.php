<?php

define('LARAVEL_START', microtime(true));

require __DIR__ . '/../vendor/autoload.php';

$app = require_once __DIR__ . '/../bootstrap/app.php';

use Lunar\Models\Product;
use Lunar\Models\ProductVariant;
use Lunar\Models\Price;
use Lunar\Models\Currency;
use Lunar\Models\TaxClass;
use Lunar\Models\ProductType;
use Lunar\Models\Url;
use Lunar\Base\AttributeData;
use Illuminate\Support\Str;

$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$pt = ProductType::first() ?? ProductType::create(['name' => 'General']);
$currency = Currency::getDefault() ?? Currency::whereDefault(true)->first();
$taxClass = TaxClass::first() ?? TaxClass::create(['name' => 'Default']);

$testProducts = [
    [
        'name' => 'Ergonomic Orthopedic Dog Bed',
        'description' => 'Memory foam dog bed designed for maximum joint support and comfort.',
        'price' => 89.99,
        'sku' => 'PET-BED-001',
        'stock' => 50,
        'image' => 'https://images.unsplash.com/photo-1541591047357-1230fb3079bc?q=80&w=1000'
    ],
    [
        'name' => 'Interactive Smart Cat Toy',
        'description' => 'AI-powered toy that moves unpredictably to keep your cat engaged and active.',
        'price' => 34.50,
        'sku' => 'PET-TOY-002',
        'stock' => 120,
        'image' => 'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?q=80&w=1000'
    ],
    [
        'name' => 'Smart GPS Pet Tracker',
        'description' => 'Real-time location tracking and activity monitoring for your adventurous pets.',
        'price' => 129.00,
        'sku' => 'PET-GPS-003',
        'stock' => 15,
        'image' => 'https://images.unsplash.com/photo-1583511655857-d19b40a7a54e?q=80&w=1000'
    ],
    [
        'name' => 'Premium Grain-Free Salmon Cat Food',
        'description' => 'High-protein, grain-free formula with real salmon for a healthy coat and skin.',
        'price' => 45.99,
        'sku' => 'PET-FOOD-004',
        'stock' => 200,
        'image' => 'https://images.unsplash.com/photo-1589923188900-85dae523342b?q=80&w=1000'
    ],
    [
        'name' => 'Automatic Pet Water Fountain',
        'description' => 'Ultra-quiet water fountain with carbon filtration to keep water fresh and clean.',
        'price' => 39.95,
        'sku' => 'PET-ACC-005',
        'stock' => 75,
        'image' => 'https://images.unsplash.com/photo-1601758228041-f3b2795255f1?q=80&w=1000'
    ],
    [
        'name' => 'Portable Travel Pet Carrier',
        'description' => 'Airline-approved soft-sided carrier for safe and comfortable travel with your pet.',
        'price' => 55.00,
        'sku' => 'PET-TRAV-006',
        'stock' => 40,
        'image' => 'https://images.unsplash.com/photo-1583337130417-3346a1be7dee?q=80&w=1000'
    ]
];

echo "Starting product seed...\n";

foreach ($testProducts as $data) {
    if (ProductVariant::whereSku($data['sku'])->exists()) {
        echo "Skipping {$data['name']} (SKU exists)\n";
        continue;
    }

    $product = Product::create([
        'product_type_id' => $pt->id,
        'attribute_data' => [
            'name' => new \Lunar\FieldTypes\Text($data['name']),
            'description' => new \Lunar\FieldTypes\Text($data['description']),
        ],
        'status' => 'published',
    ]);

    $variant = ProductVariant::create([
        'product_id' => $product->id,
        'sku' => $data['sku'],
        'stock' => $data['stock'],
        'shippable' => true,
        'tax_class_id' => $taxClass->id,
    ]);

    Price::create([
        'priceable_type' => ProductVariant::class,
        'priceable_id' => $variant->id,
        'currency_id' => $currency->id,
        'price' => (int) ($data['price'] * 100), // Prices in Lunar are stored as cents
        'tier' => 1,
    ]);

    // Create URL for product
    Url::create([
        'language_id' => 1, // Defaulting to 1, check if needed
        'element_type' => Product::class,
        'element_id' => $product->id,
        'slug' => Str::slug($data['name']),
        'default' => true,
    ]);

    echo "Created: {$data['name']}\n";
}

echo "Seeding complete!\n";
