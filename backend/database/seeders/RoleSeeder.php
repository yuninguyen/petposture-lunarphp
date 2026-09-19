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
            ...AdminAbilityRegistry::COLLECTION_GROUPS,
            ...AdminAbilityRegistry::COLLECTIONS,
            ...AdminAbilityRegistry::PRODUCT_TYPES,
            ...AdminAbilityRegistry::CUSTOM_FIELDS,
            ...AdminAbilityRegistry::SOLUTIONS,
            ...AdminAbilityRegistry::COMMENTS,
            ...AdminAbilityRegistry::BLOG_TAGS,
            ...AdminAbilityRegistry::PAGES,
            ...AdminAbilityRegistry::MEDIA,
            ...AdminAbilityRegistry::SEO_SOCIAL,
            ...AdminAbilityRegistry::AFFILIATE_NETWORKS_SELECTOR,
            ...AdminAbilityRegistry::USERS,
            ...AdminAbilityRegistry::GOALS,
            ...AdminAbilityRegistry::SYSTEM_MEDIA,
            ...AdminAbilityRegistry::SYSTEM_ACTIVITY_LOGS,
            ...AdminAbilityRegistry::AFFILIATE_REPORTS,
            ...AdminAbilityRegistry::SYSTEM_ROLES,
            ...AdminAbilityRegistry::SYSTEM_USERS,
            ...AdminAbilityRegistry::AFFILIATE_NETWORKS,
            ...AdminAbilityRegistry::DASHBOARD_SALES,
            ...AdminAbilityRegistry::DASHBOARD_CONVERSION,
            ...AdminAbilityRegistry::REVIEWS,
            ...AdminAbilityRegistry::RETURN_REQUESTS,
        ]);

        $permissions = collect($allPermissions)
            ->mapWithKeys(fn (string $name) => [
                $name => Permission::query()->firstOrCreate([
                    'name' => $name,
                    'guard_name' => 'web',
                ]),
            ]);

        $reviewAbilities = [
            'view_any_review',
            'view_review',
            'update_review',
            'delete_review',
        ];

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
                        ...AdminAbilityRegistry::COLLECTION_GROUPS,
                        ...AdminAbilityRegistry::COLLECTIONS,
                        ...AdminAbilityRegistry::PRODUCT_TYPES,
                        ...AdminAbilityRegistry::CUSTOM_FIELDS,
                        ...AdminAbilityRegistry::SOLUTIONS,
                        ...$reviewAbilities,
                    ]);
                }

                if (in_array($roleName, ['Order Manager', 'Support'], true)) {
                    $rolePermissions = array_unique([
                        ...$rolePermissions,
                        ...AdminAbilityRegistry::DASHBOARD_SALES,
                        ...AdminAbilityRegistry::DASHBOARD_CONVERSION,
                        ...AdminAbilityRegistry::RETURN_REQUESTS,
                    ]);
                }

                if ($roleName === 'Support') {
                    $rolePermissions = array_unique([
                        ...$rolePermissions,
                        ...$reviewAbilities,
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
                    $role->givePermissionTo(AdminAbilityRegistry::COLLECTION_GROUPS);
                    $role->givePermissionTo(AdminAbilityRegistry::COLLECTIONS);
                    $role->givePermissionTo(AdminAbilityRegistry::PRODUCT_TYPES);
                    $role->givePermissionTo(AdminAbilityRegistry::CUSTOM_FIELDS);
                    $role->givePermissionTo(AdminAbilityRegistry::SOLUTIONS);
                    $role->givePermissionTo($reviewAbilities);
                }

                if (in_array($roleName, ['Order Manager', 'Support'], true)) {
                    $role->givePermissionTo(AdminAbilityRegistry::DASHBOARD_SALES);
                    $role->givePermissionTo(AdminAbilityRegistry::DASHBOARD_CONVERSION);
                    $role->givePermissionTo(AdminAbilityRegistry::RETURN_REQUESTS);
                }

                if ($roleName === 'Support') {
                    $role->givePermissionTo($reviewAbilities);
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
