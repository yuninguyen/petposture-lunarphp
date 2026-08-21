<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;

class AdminUserSeeder extends Seeder
{
    public function run(): void
    {
        // Create or update admin user
        $user = User::firstOrCreate(
            ['email' => 'yuninguyen.it@gmail.com'],
            [
                'name' => 'Yuni Nguyen',
                'password' => '@Yuni2026',
                'is_active' => true,
            ]
        );

        // Assign admin role
        $user->syncRoles(['admin']);
    }
}
