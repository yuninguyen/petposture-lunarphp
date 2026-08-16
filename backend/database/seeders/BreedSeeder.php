<?php

namespace Database\Seeders;

use App\Models\Breed;
use Illuminate\Database\Seeder;

class BreedSeeder extends Seeder
{
    public function run(): void
    {
        foreach ($this->breeds() as $breed) {
            Breed::updateOrCreate(['slug' => $breed['slug']], $breed);
        }
    }

    private function breeds(): array
    {
        return [
            [
                'name' => 'Dachshund',
                'slug' => 'dachshund',
                'body_type' => 'long-backed',
                'description' => 'Long-backed, short-legged dogs that need extra care around furniture access, jumping and spinal support.',
            ],
            [
                'name' => 'French Bulldog',
                'slug' => 'french-bulldog',
                'body_type' => 'flat-faced',
                'description' => 'Flat-faced dogs that benefit from elevated, tilted feeding setups and harnesses fitted for a shorter snout and broader chest.',
            ],
            [
                'name' => 'Pug',
                'slug' => 'pug',
                'body_type' => 'flat-faced',
                'description' => 'Flat-faced dogs prone to overheating and feeding difficulty, benefiting from cooling and slow-feeding products.',
            ],
            [
                'name' => 'Bulldog',
                'slug' => 'bulldog',
                'body_type' => 'flat-faced',
                'description' => 'Flat-faced, broad-chested dogs that do best with supportive bedding and feeding gear sized for their build.',
            ],
            [
                'name' => 'Corgi',
                'slug' => 'corgi',
                'body_type' => 'long-backed',
                'description' => 'Long-backed, short-legged dogs that benefit from ramps, stairs and supportive beds sized for a longer body and shorter legs.',
            ],
        ];
    }
}
