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
     * Seeds custom field abilities idempotently for production and development.
     * Ensures Product Manager and core roles receive custom field permissions even
     * if RoleSeeder already executed in earlier deployments.
     */
    public function up(): void
    {
        app(PermissionRegistrar::class)->forgetCachedPermissions();

        foreach (AdminAbilityRegistry::CUSTOM_FIELDS as $name) {
            Permission::query()->firstOrCreate([
                'name' => $name,
                'guard_name' => 'web',
            ]);
        }

        // Grant custom field abilities to Product Manager
        $productManager = Role::query()
            ->where('name', 'Product Manager')
            ->where('guard_name', 'web')
            ->first();

        if ($productManager) {
            $productManager->givePermissionTo(AdminAbilityRegistry::CUSTOM_FIELDS);
        }

        // Core admin roles (super_admin, admin, staff)
        foreach (AdminAbilityRegistry::coreRoles() as $coreRole) {
            $role = Role::query()
                ->where('name', $coreRole)
                ->where('guard_name', 'web')
                ->first();

            if ($role) {
                $role->givePermissionTo(AdminAbilityRegistry::CUSTOM_FIELDS);
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
