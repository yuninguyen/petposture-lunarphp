<?php

namespace Database\Seeders;

use App\Security\AdminAbilityRegistry;
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

        $allPermissions = array_unique([
            ...AdminPermissionMatrix::allPermissions(),
            ...AdminAbilityRegistry::BRANDS,
            ...AdminAbilityRegistry::BREEDS,
        ]);

        $permissions = collect($allPermissions)
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
                $rolePermissions = AdminPermissionMatrix::permissionsForRole($roleName);
                if ($roleName === 'Product Manager') {
                    $rolePermissions = array_unique([
                        ...$rolePermissions,
                        ...AdminAbilityRegistry::BRANDS,
                        ...AdminAbilityRegistry::BREEDS,
                    ]);
                }

                $role->syncPermissions(
                    collect($rolePermissions)
                        ->map(fn (string $permission) => $permissions->get($permission))
                        ->filter()
                        ->values(),
                );
            } else {
                if ($roleName === 'Product Manager') {
                    $role->givePermissionTo(AdminAbilityRegistry::BRANDS);
                    $role->givePermissionTo(AdminAbilityRegistry::BREEDS);
                }
            }
        }

        Role::query()->firstOrCreate([
            'name' => 'customer',
            'guard_name' => 'web',
        ]);

        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }
}
