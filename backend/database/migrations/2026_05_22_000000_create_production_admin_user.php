<?php

use App\Models\User;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Hash;
use Spatie\Permission\Models\Role;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // 1. Ensure 'super_admin' role exists
        $adminRole = Role::firstOrCreate(['name' => 'super_admin', 'guard_name' => 'web']);

        // 2. Create or update the admin user
        $user = User::updateOrCreate(
            ['email' => 'yuninguyen.it@gmail.com'],
            [
                'name' => 'Yuni Nguyen',
                'password' => Hash::make('@Yuni2026'),
            ]
        );

        // 3. Assign the super_admin role to the user
        if (!$user->hasRole('super_admin')) {
            $user->assignRole($adminRole);
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        $user = User::where('email', 'yuninguyen.it@gmail.com')->first();
        if ($user) {
            $user->delete();
        }
    }
};
