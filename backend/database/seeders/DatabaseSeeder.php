<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        $this->call([
            RoleSeeder::class,
            BreedSeeder::class,
            SolutionSeeder::class,
            AdminUserSeeder::class,
            BlogCategorySeeder::class,
            BlogPostSeeder::class,
        ]);
    }
}
