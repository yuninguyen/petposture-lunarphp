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
     * Seeds the Pinterest Pins abilities idempotently for production and development.
     * Grants them exclusively to core roles (super_admin, admin, staff): pins are prepared in the admin and
     * posted by hand, and no business role (Product Manager, Order Manager, Support, Content Writer) gets access.
     * A business role that was given one later by hand keeps it: this never revokes.
     */
    public function up(): void
    {
        app(PermissionRegistrar::class)->forgetCachedPermissions();

        foreach (AdminAbilityRegistry::PINTEREST_PINS as $name) {
            Permission::query()->firstOrCreate([
                'name' => $name,
                'guard_name' => 'web',
            ]);
        }

        foreach (AdminAbilityRegistry::coreRoles() as $coreRole) {
            $role = Role::query()
                ->where('name', $coreRole)
                ->where('guard_name', 'web')
                ->first();

            if ($role) {
                $role->givePermissionTo(AdminAbilityRegistry::PINTEREST_PINS);
            }
        }

        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }

    public function down(): void
    {
        // Non-destructive rollback to preserve potential manual operator customizations.
    }
};
