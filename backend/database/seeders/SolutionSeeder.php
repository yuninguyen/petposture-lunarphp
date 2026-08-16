<?php

namespace Database\Seeders;

use App\Models\Solution;
use Illuminate\Database\Seeder;

class SolutionSeeder extends Seeder
{
    public function run(): void
    {
        foreach ($this->solutions() as $solution) {
            Solution::updateOrCreate(['slug' => $solution['slug']], $solution);
        }
    }

    private function solutions(): array
    {
        return [
            [
                'name' => 'Feeding',
                'slug' => 'feeding',
                'description' => 'Eating and drinking products — tilted bowls, slow feeders and water fountains.',
            ],
            [
                'name' => 'Comfort',
                'slug' => 'comfort',
                'description' => 'Resting and everyday comfort — supportive beds and cooling mats.',
            ],
            [
                'name' => 'Mobility',
                'slug' => 'mobility',
                'description' => 'Everyday access and movement — ramps, stairs and strollers.',
            ],
            [
                'name' => 'Walking',
                'slug' => 'walking',
                'description' => 'Fit and control for daily walks — harnesses.',
            ],
        ];
    }
}
