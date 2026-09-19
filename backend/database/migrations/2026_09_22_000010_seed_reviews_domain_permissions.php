<?php

declare(strict_types=1);

use App\Security\AdminAbilityRegistry;
use Illuminate\Database\Migrations\Migration;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * Seeds review abilities idempotently for production and development.
     * Grants full abilities to core roles (super_admin, admin, staff).
     * Grants granular review abilities (including delete_review) to Product Manager and Support.
     */
    public function up(): void
    {
        app(PermissionRegistrar::class)->forgetCachedPermissions();

        foreach (AdminAbilityRegistry::REVIEWS as $name) {
            Permission::query()->firstOrCreate([
                'name' => $name,
                'guard_name' => 'web',
            ]);
        }

        // Core admin roles receive all review permissions
        foreach (AdminAbilityRegistry::coreRoles() as $coreRole) {
            $role = Role::query()
                ->where('name', $coreRole)
                ->where('guard_name', 'web')
                ->first();

            if ($role) {
                $role->givePermissionTo(AdminAbilityRegistry::REVIEWS);
            }
        }

        // Product Manager & Support receive identical active abilities:
        // view_any_review, view_review, update_review, delete_review
        $businessAbilities = [
            'view_any_review',
            'view_review',
            'update_review',
            'delete_review',
        ];

        foreach (['Product Manager', 'Support'] as $roleName) {
            $role = Role::query()
                ->where('name', $roleName)
                ->where('guard_name', 'web')
                ->first();

            if ($role) {
                $role->givePermissionTo($businessAbilities);
            }
        }

        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Non-destructive rollback to preserve potential manual operator customizations.
    }
};
