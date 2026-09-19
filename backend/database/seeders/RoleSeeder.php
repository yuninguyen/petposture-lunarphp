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
            ...AdminAbilityRegistry::ORDERS,
            ...AdminAbilityRegistry::POSTS,
            'view_any_blog_category',
            'view_blog_category',
            'create_blog_category',
            'update_blog_category',
            'delete_blog_category',
            'delete_any_blog_category',
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

        $orderManagerOrderAbilities = [
            'view_any_order',
            'view_order',
            'create_order',
            'update_order',
            'refund_order',
        ];

        $supportOrderAbilities = [
            'view_any_order',
            'view_order',
            'create_order',
            'update_order',
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
                        ...($roleName === 'Order Manager' ? $orderManagerOrderAbilities : $supportOrderAbilities),
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
                    // Orders abilities (including refund_order) are backfilled once by the
                    // 2026_09_23_000001 migration, not re-granted here on every reseed —
                    // refund_order predates this registry and an admin may have manually
                    // revoked it via the Roles & Permissions UI; reseeding must not restore it.
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
