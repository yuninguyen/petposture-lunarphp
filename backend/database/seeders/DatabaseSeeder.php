<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Category;
use App\Models\Product;
use Illuminate\Support\Str;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        // 1. Create Categories
        $categories = [
            ['name' => 'Beds', 'slug' => 'beds', 'image_url' => '/assets/Pug-Dog-Bed.jpg'],
            ['name' => 'Bowls', 'slug' => 'bowls', 'image_url' => '/assets/Dog-Bowls-5.png'],
            ['name' => 'Support', 'slug' => 'support', 'image_url' => '/assets/badposture-goodposture.jpg'],
        ];

        foreach ($categories as $cat) {
            Category::create($cat);
        }

        // 2. Create Products
        $products = [
            [
                'category_id' => 1,
                'name' => 'OrthoComfort Memory Foam Bed',
                'description' => 'Veterinary approved memory foam bed for spinal health.',
                'price' => 129.99,
                'old_price' => 159.99,
                'rating' => 4.9,
                'reviews_count' => 124,
                'image_url' => '/assets/Pug-Dog-Bed.jpg',
                'badge' => 'Best Seller',
                'is_new' => true,
                'is_active' => true,
            ],
            [
                'category_id' => 2,
                'name' => 'ErgoFeed Adjustable Bowl',
                'description' => '15-degree tilted bowl to reduce neck strain during feeding.',
                'price' => 45.00,
                'old_price' => null,
                'rating' => 4.8,
                'reviews_count' => 89,
                'image_url' => '/assets/Dog-Bowls-5.png',
                'badge' => 'Veterinary Approved',
                'is_new' => false,
                'is_active' => true,
            ],
            [
                'category_id' => 3,
                'name' => 'SpinalGuard Posture Brace',
                'description' => 'Lightweight brace for post-surgery or senior dog mobility.',
                'price' => 85.00,
                'old_price' => 99.00,
                'rating' => 5.0,
                'reviews_count' => 42,
                'image_url' => '/assets/badposture-goodposture.jpg',
                'badge' => 'New Arrival',
                'is_new' => true,
                'is_active' => true,
            ],
        ];

        foreach ($products as $prod) {
            Product::create($prod);
        }
    }
}
