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
     * Creates the "Content Writer" business role idempotently for production and development.
     * It drafts posts for an admin to review and publish; it is not a core role, so it does not
     * bypass Gate checks (see AdminAbilityRegistry::CONTENT_WRITER for exactly what it may do).
     */
    public function up(): void
    {
        app(PermissionRegistrar::class)->forgetCachedPermissions();

        foreach (AdminAbilityRegistry::CONTENT_WRITER as $name) {
            Permission::query()->firstOrCreate([
                'name' => $name,
                'guard_name' => 'web',
            ]);
        }

        $role = Role::query()->firstOrCreate([
            'name' => 'Content Writer',
            'guard_name' => 'web',
        ]);

        // First run only: once an admin has adjusted the role in the Roles & Permissions UI,
        // the database is the source of truth and must not be overwritten.
        if ($role->permissions()->count() === 0) {
            $role->givePermissionTo(AdminAbilityRegistry::CONTENT_WRITER);
        }

        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Non-destructive rollback: the role may already be assigned to people.
    }
};
