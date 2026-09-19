<?php

declare(strict_types=1);

use App\Security\AdminAbilityRegistry;
use Illuminate\Database\Migrations\Migration;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

return new class extends Migration
{
    public function up(): void
    {
        app(PermissionRegistrar::class)->forgetCachedPermissions();

        foreach (AdminAbilityRegistry::ORDERS as $name) {
            Permission::query()->firstOrCreate([
                'name' => $name,
                'guard_name' => 'web',
            ]);
        }

        foreach (AdminAbilityRegistry::coreRoles() as $roleName) {
            $role = Role::query()->where('name', $roleName)->where('guard_name', 'web')->first();

            if ($role) {
                $role->givePermissionTo(AdminAbilityRegistry::ORDERS);
            }
        }

        $orderManager = Role::query()->where('name', 'Order Manager')->where('guard_name', 'web')->first();
        if ($orderManager) {
            $orderManager->givePermissionTo([
                'view_any_order',
                'view_order',
                'create_order',
                'update_order',
                'refund_order',
            ]);
        }

        $support = Role::query()->where('name', 'Support')->where('guard_name', 'web')->first();
        if ($support) {
            $support->givePermissionTo([
                'view_any_order',
                'view_order',
                'create_order',
                'update_order',
            ]);
            $support->revokePermissionTo('refund_order');
        }

        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }

    public function down(): void
    {
        // Preserve operator-managed permission assignments on rollback.
    }
};
