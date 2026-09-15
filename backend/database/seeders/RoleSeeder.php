<?php

namespace Database\Seeders;

use App\Security\AdminPermissionMatrix;
use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

class RoleSeeder extends Seeder
{
    public function run(): void
    {
        app(PermissionRegistrar::class)->forgetCachedPermissions();

        $permissions = collect(AdminPermissionMatrix::allPermissions())
            ->mapWithKeys(fn (string $name) => [
                $name => Permission::query()->firstOrCreate([
                    'name' => $name,
                    'guard_name' => 'web',
                ]),
            ]);

        foreach (AdminPermissionMatrix::adminRoles() as $roleName) {
            $role = Role::query()->firstOrCreate([
                'name' => $roleName,
                'guard_name' => 'web',
            ]);

            if (in_array($roleName, ['super_admin', 'admin', 'staff'], true)) {
                $role->syncPermissions(Permission::query()->where('guard_name', 'web')->get());
                continue;
            }

            // Business roles: only seed on first run (role has zero permissions yet).
            // Once an admin has customized permissions via the Roles & Permissions UI
            // (built in a later phase), the DB is the source of truth — re-running
            // this seeder must never silently overwrite those edits.
            if ($role->permissions()->count() === 0) {
                $role->syncPermissions(
                    collect(AdminPermissionMatrix::permissionsForRole($roleName))
                        ->map(fn (string $permission) => $permissions->get($permission))
                        ->filter()
                        ->values(),
                );
            }
        }

        Role::query()->firstOrCreate([
            'name' => 'customer',
            'guard_name' => 'web',
        ]);

        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }
}
