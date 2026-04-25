<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Lunar\Models\Product;
use Lunar\Models\ProductVariant;
use Lunar\Models\Price;
use Lunar\Models\Currency;
use Lunar\Models\TaxClass;
use Lunar\Models\ProductType;
use Lunar\Models\Url;
use Illuminate\Support\Str;

class TestProductSeeder extends Seeder
{
    public function run(): void
    {
        $pt = ProductType::first() ?? ProductType::create(['name' => 'General']);
        $currency = Currency::getDefault() ?? Currency::whereDefault(true)->first();
        $taxClass = TaxClass::first() ?? TaxClass::create(['name' => 'Default']);
        $channel = \Lunar\Models\Channel::first();
        $customerGroup = \Lunar\Models\CustomerGroup::first();
        $category = \App\Models\Category::first();

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

        foreach ($testProducts as $data) {
            // Use ProductVariant model to check SKU existence
            if (ProductVariant::whereSku($data['sku'])->exists()) {
                continue;
            }

            $product = Product::create([
                'product_type_id' => $pt->id,
                'category_id' => $category?->id,
                'attribute_data' => [
                    'name' => new \Lunar\FieldTypes\Text($data['name']),
                    'description' => new \Lunar\FieldTypes\Text($data['description']),
                ],
                'status' => 'published',
            ]);

            // Associate with Channel
            if ($channel) {
                $product->channels()->syncWithPivotValues([$channel->id], [
                    'enabled' => true,
                    'starts_at' => now(),
                ], false);
            }

            // Associate with Customer Group
            if ($customerGroup) {
                $product->customerGroups()->syncWithPivotValues([$customerGroup->id], [
                    'enabled' => true,
                    'starts_at' => now(),
                ], false);
            }

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
                'price' => (int) ($data['price'] * 100),
                'tier' => 1,
            ]);

            Url::create([
                'language_id' => 1,
                'element_type' => Product::class,
                'element_id' => $product->id,
                'slug' => Str::slug($data['name']),
                'default' => true,
            ]);
        }
    }
}
