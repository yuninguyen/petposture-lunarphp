<?php

namespace Database\Seeders;

use App\Models\Category;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

class CategorySeeder extends Seeder
{
    public function run(): void
    {
        $categories = [
            [
                'name' => 'Bowls',
                'description' => 'Ergonomic feeding bowls for a healthier posture.',
                'image_url' => null,
            ],
            [
                'name' => 'Ramps',
                'description' => 'Safe pet ramps that ease joint tension for climbing.',
                'image_url' => null,
            ],
            [
                'name' => 'Beds',
                'description' => 'Comfortable orthopaedic beds for pets.',
                'image_url' => null,
            ],
            [
                'name' => 'Harnesses',
                'description' => 'Supportive harnesses reducing spinal strain.',
                'image_url' => null,
            ],
        ];

        foreach ($categories as $cat) {
            Category::updateOrCreate(
                ['slug' => Str::slug($cat['name'])],
                [
                    'name' => $cat['name'],
                    'description' => $cat['description'],
                    'image_url' => $cat['image_url'],
                ]
            );
        }
    }
}
