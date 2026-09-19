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
     * Seeds media library abilities idempotently for production and development.
     * Grants permissions exclusively to core roles (super_admin, admin, staff).
     * Business roles (Product Manager, Order Manager, Support) receive NO access.
     */
    public function up(): void
    {
        app(PermissionRegistrar::class)->forgetCachedPermissions();

        foreach (AdminAbilityRegistry::MEDIA as $name) {
            Permission::query()->firstOrCreate([
                'name' => $name,
                'guard_name' => 'web',
            ]);
        }

        // Core admin roles only (super_admin, admin, staff)
        foreach (AdminAbilityRegistry::coreRoles() as $coreRole) {
            $role = Role::query()
                ->where('name', $coreRole)
                ->where('guard_name', 'web')
                ->first();

            if ($role) {
                $role->givePermissionTo(AdminAbilityRegistry::MEDIA);
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
