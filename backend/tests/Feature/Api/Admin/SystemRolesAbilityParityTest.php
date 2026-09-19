<?php

declare(strict_types=1);

namespace Tests\Feature\Api\Admin;

use App\Models\User;
use App\Security\AdminAbilityRegistry;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

/**
 * Parity test suite for Phase 6b: System Roles Domain Migration.
 *
 * Verifies exact 100% status code parity across all 7 roles for:
 * - GET /api/admin/system/roles (view_any_role)
 * - PUT /api/admin/system/roles/{role} (update_role)
 *
 * - Allowed (super_admin, admin, staff): 200 OK.
 * - Blocked (Product Manager, Order Manager, Support, customer): 403 Forbidden.
 */
class SystemRolesAbilityParityTest extends TestCase
{
    use RefreshDatabase;

    private const ALLOWED_ROLES = [
        'super_admin',
        'admin',
        'staff',
    ];

    private const BLOCKED_ROLES = [
        'Product Manager',
        'Order Manager',
        'Support',
        'customer',
    ];

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
    }

    public function test_allowed_roles_can_list_system_roles(): void
    {
        foreach (self::ALLOWED_ROLES as $role) {
            $this->actingAsRole($role);

            $response = $this->getJson('/api/admin/system/roles');

            $response->assertOk(
                "Role '{$role}' must be permitted to view system roles (GET /api/admin/system/roles)."
            );
            $response->assertJsonStructure(['data', 'permission_groups']);
        }
    }

    public function test_blocked_roles_cannot_list_system_roles(): void
    {
        foreach (self::BLOCKED_ROLES as $role) {
            $this->actingAsRole($role);

            $response = $this->getJson('/api/admin/system/roles');

            $response->assertForbidden(
                "Role '{$role}' must be forbidden from viewing system roles (GET /api/admin/system/roles)."
            );
        }
    }

    public function test_allowed_roles_can_update_system_role_permissions(): void
    {
        $editableRole = Role::query()->where('name', 'Order Manager')->where('guard_name', 'web')->firstOrFail();

        foreach (self::ALLOWED_ROLES as $role) {
            $this->actingAsRole($role);

            $response = $this->putJson("/api/admin/system/roles/{$editableRole->id}", [
                'permissions' => [],
            ]);

            $response->assertOk(
                "Role '{$role}' must be permitted to update system role (PUT /api/admin/system/roles/{$editableRole->id})."
            );
        }
    }

    public function test_blocked_roles_cannot_update_system_role_permissions(): void
    {
        $editableRole = Role::query()->where('name', 'Order Manager')->where('guard_name', 'web')->firstOrFail();

        foreach (self::BLOCKED_ROLES as $role) {
            $this->actingAsRole($role);

            $response = $this->putJson("/api/admin/system/roles/{$editableRole->id}", [
                'permissions' => [],
            ]);

            $response->assertForbidden(
                "Role '{$role}' must be forbidden from updating system role (PUT /api/admin/system/roles/{$editableRole->id})."
            );
        }
    }

    public function test_migration_seeds_and_assigns_system_role_permissions_to_core_roles_only(): void
    {
        $migration = require database_path('migrations/2026_09_22_000005_seed_system_roles_domain_permissions.php');
        $migration->up();

        $admin = Role::query()->where('name', 'admin')->where('guard_name', 'web')->first();
        $this->assertNotNull($admin);

        foreach (AdminAbilityRegistry::SYSTEM_ROLES as $permission) {
            $this->assertTrue(
                $admin->hasPermissionTo($permission),
                "Admin must have permission '{$permission}' after migration."
            );
        }

        foreach (['Product Manager', 'Order Manager', 'Support'] as $businessRole) {
            $role = Role::query()->where('name', $businessRole)->where('guard_name', 'web')->first();
            $this->assertNotNull($role);

            foreach (AdminAbilityRegistry::SYSTEM_ROLES as $permission) {
                $this->assertFalse(
                    $role->hasPermissionTo($permission),
                    "Business role '{$businessRole}' must NOT have permission '{$permission}'."
                );
            }
        }
    }

    public function test_unauthenticated_request_is_unauthorized(): void
    {
        $editableRole = Role::query()->where('name', 'Order Manager')->where('guard_name', 'web')->firstOrFail();

        $this->getJson('/api/admin/system/roles')->assertUnauthorized();
        $this->putJson("/api/admin/system/roles/{$editableRole->id}", ['permissions' => []])->assertUnauthorized();
    }

    private function actingAsRole(string $role): User
    {
        $user = User::factory()->create();
        $user->assignRole($role);
        Sanctum::actingAs($user);

        return $user;
    }
}
