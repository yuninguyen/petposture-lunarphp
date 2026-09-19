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
     * Seeds collection group abilities idempotently for production and development.
     * Ensures Product Manager and core roles receive collection group permissions even
     * if RoleSeeder already executed in earlier deployments.
     */
    public function up(): void
    {
        app(PermissionRegistrar::class)->forgetCachedPermissions();

        foreach (AdminAbilityRegistry::COLLECTION_GROUPS as $name) {
            Permission::query()->firstOrCreate([
                'name' => $name,
                'guard_name' => 'web',
            ]);
        }

        // Grant collection group abilities to Product Manager
        $productManager = Role::query()
            ->where('name', 'Product Manager')
            ->where('guard_name', 'web')
            ->first();

        if ($productManager) {
            $productManager->givePermissionTo(AdminAbilityRegistry::COLLECTION_GROUPS);
        }

        // Core admin roles (super_admin, admin, staff)
        foreach (AdminAbilityRegistry::coreRoles() as $coreRole) {
            $role = Role::query()
                ->where('name', $coreRole)
                ->where('guard_name', 'web')
                ->first();

            if ($role) {
                $role->givePermissionTo(AdminAbilityRegistry::COLLECTION_GROUPS);
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
