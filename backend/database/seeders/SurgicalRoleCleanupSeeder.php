<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Role;
use Spatie\Permission\Models\Permission;
use Illuminate\Support\Facades\DB;

class SurgicalRoleCleanupSeeder extends Seeder
{
    public function run(): void
    {
        // 1. Resolve duplicates by prioritizing 'web' guard
        $roles = Role::all();

        foreach ($roles as $role) {
            if ($role->guard_name !== 'web') {
                $webEquivalent = Role::where('name', $role->name)
                    ->where('guard_name', 'web')
                    ->first();

                if ($webEquivalent) {
                    // Update any users/permissions tied to this non-web role to the web version
                    DB::table('model_has_roles')->where('role_id', $role->id)->update(['role_id' => $webEquivalent->id]);
                    DB::table('role_has_permissions')->where('role_id', $role->id)->update(['role_id' => $webEquivalent->id]);

                    // delete the duplicate non-web role
                    $role->delete();
                } else {
                    // update this role to web if no duplicate exists
                    $role->update(['guard_name' => 'web']);
                }
            }
        }

        // 2. Ensure mandatory roles exist
        $mandatoryRoles = [
            'super_admin',
            'admin',
            'staff',
            'Product Manager',
            'Order Manager',
            'Support',
            'customer',
        ];

        foreach ($mandatoryRoles as $roleName) {
            Role::firstOrCreate(['name' => $roleName, 'guard_name' => 'web']);
        }

        // 3. Repeat for permissions to be safe
        $permissions = Permission::all();
        foreach ($permissions as $permission) {
            if ($permission->guard_name !== 'web') {
                $permission->update(['guard_name' => 'web']);
            }
        }
    }
}
