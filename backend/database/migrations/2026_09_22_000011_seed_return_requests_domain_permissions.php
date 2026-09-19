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
     * Seeds return-requests abilities idempotently for production and development.
     * Grants full return-requests abilities to core roles (super_admin, admin, staff),
     * Order Manager, and Support.
     */
    public function up(): void
    {
        app(PermissionRegistrar::class)->forgetCachedPermissions();

        foreach (AdminAbilityRegistry::RETURN_REQUESTS as $name) {
            Permission::query()->firstOrCreate([
                'name' => $name,
                'guard_name' => 'web',
            ]);
        }

        $allowedRoles = [
            ...AdminAbilityRegistry::coreRoles(),
            'Order Manager',
            'Support',
        ];

        foreach ($allowedRoles as $roleName) {
            $role = Role::query()
                ->where('name', $roleName)
                ->where('guard_name', 'web')
                ->first();

            if ($role) {
                $role->givePermissionTo(AdminAbilityRegistry::RETURN_REQUESTS);
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
