<?php

namespace Database\Seeders;

use App\Models\Category;
use App\Models\Product;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

class ProductSeeder extends Seeder
{
    public function run(): void
    {
        $bowls = Category::where('name', 'Bowls')->first()->id;
        $ramps = Category::where('name', 'Ramps')->first()->id;
        $beds = Category::where('name', 'Beds')->first()->id;
        $harnesses = Category::where('name', 'Harnesses')->first()->id;

        $products = [
            [
                'category_id' => $bowls,
                'name' => "PetPosture: The Mealtime Difference Bowl",
                'price' => 59.99,
                'old_price' => 85.00,
                'rating' => 5,
                'reviews_count' => 214,
                'image_url' => "/assets/Dog-Bowls-5.png",
                'badge' => "SALE",
                'is_new' => false,
                'stock_quantity' => 100,
            ],
            [
                'category_id' => $bowls,
                'name' => "Corgi Ergonomic Feeding Stand",
                'price' => 49.99,
                'old_price' => 69.99,
                'rating' => 5,
                'reviews_count' => 156,
                'image_url' => "/assets/Corgi.png",
                'badge' => "SALE",
                'is_new' => true,
                'stock_quantity' => 50,
            ],
            [
                'category_id' => $bowls,
                'name' => "PosturePro™ Tilted Bowl",
                'price' => 29.00,
                'old_price' => null,
                'rating' => 5,
                'reviews_count' => 308,
                'image_url' => "/assets/Flat-Faced-Breeds.png",
                'badge' => "BEST SELLER",
                'is_new' => false,
                'stock_quantity' => 200,
            ],
            [
                'category_id' => $ramps,
                'name' => "ErgoStep™ Pet Ramp",
                'price' => 49.00,
                'old_price' => null,
                'rating' => 5,
                'reviews_count' => 182,
                'image_url' => "/assets/Shop-by-Breed.jpg",
                'badge' => null,
                'is_new' => true,
                'stock_quantity' => 30,
            ],
            [
                'category_id' => $beds,
                'name' => "ComfortRest™ Memory Bed",
                'price' => 89.00,
                'old_price' => null,
                'rating' => 5,
                'reviews_count' => 425,
                'image_url' => "/assets/Pug-Dog-Bed.jpg",
                'badge' => "PREMIUM",
                'is_new' => false,
                'stock_quantity' => 40,
            ],
            [
                'category_id' => $harnesses,
                'name' => "SpineSave™ Support Harness",
                'price' => 34.00,
                'old_price' => null,
                'rating' => 4,
                'reviews_count' => 97,
                'image_url' => "/assets/shop-by-solutions.jpg",
                'badge' => null,
                'is_new' => true,
                'stock_quantity' => 150,
            ]
        ];

        foreach ($products as $prod) {
            Product::updateOrCreate(
                ['slug' => Str::slug($prod['name'])],
                [
                    'category_id' => $prod['category_id'],
                    'name' => $prod['name'],
                    'price' => $prod['price'],
                    'old_price' => $prod['old_price'],
                    'rating' => $prod['rating'],
                    'reviews_count' => $prod['reviews_count'],
                    'image_url' => $prod['image_url'],
                    'badge' => $prod['badge'],
                    'is_new' => $prod['is_new'],
                    'stock_quantity' => $prod['stock_quantity'],
                    'description' => 'A high quality ergonomic product from PetPosture.',
                ]
            );
        }
    }
}
