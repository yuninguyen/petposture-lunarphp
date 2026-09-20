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
        $abilities = AdminAbilityRegistry::SETTINGS_AI;
        app(PermissionRegistrar::class)->forgetCachedPermissions();
        foreach ($abilities as $name) Permission::query()->firstOrCreate(['name' => $name, 'guard_name' => 'web']);
        foreach (AdminAbilityRegistry::coreRoles() as $coreRole) {
            if ($role = Role::query()->where('name', $coreRole)->where('guard_name', 'web')->first()) $role->givePermissionTo($abilities);
        }
        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }

    public function down(): void { /* Non-destructive rollback preserves manual operator customizations. */ }
};
