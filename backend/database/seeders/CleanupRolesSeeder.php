<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Role;

class CleanupRolesSeeder extends Seeder
{
    public function run(): void
    {
        $roles = Role::all();
        $seen = [];

        foreach ($roles as $role) {
            $key = $role->name . '-' . $role->guard_name;
            if (in_array($key, $seen)) {
                echo "Deleting duplicate role: {$role->name} (ID: {$role->id}, Guard: {$role->guard_name})\n";
                $role->delete();
            } else {
                $seen[] = $key;
            }
        }
    }
}
