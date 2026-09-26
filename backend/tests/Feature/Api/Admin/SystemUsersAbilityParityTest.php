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
 * Parity test suite for Phase 6b: System Users Domain Migration.
 *
 * Verifies exact 100% status code parity across all 7 roles for system users resource:
 * - GET /api/admin/system/users (view_any_system_user)
 * - POST /api/admin/system/users (create_system_user)
 * - GET /api/admin/system/users/{user} (view_system_user)
 * - PUT /api/admin/system/users/{user} (update_system_user)
 * - DELETE /api/admin/system/users/{user} (delete_system_user)
 *
 * - Allowed (super_admin, admin, staff): 200, 201, 204.
 * - Blocked (Product Manager, Order Manager, Support, customer): 403 Forbidden.
 */
class SystemUsersAbilityParityTest extends TestCase
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

    public function test_allowed_roles_can_list_system_users(): void
    {
        foreach (self::ALLOWED_ROLES as $role) {
            $this->actingAsRole($role);

            $response = $this->getJson('/api/admin/system/users');

            $response->assertOk(
                "Role '{$role}' must be permitted to list system users (GET /api/admin/system/users)."
            );
        }
    }

    public function test_blocked_roles_cannot_list_system_users(): void
    {
        foreach (self::BLOCKED_ROLES as $role) {
            $this->actingAsRole($role);

            $response = $this->getJson('/api/admin/system/users');

            $response->assertForbidden(
                "Role '{$role}' must be forbidden from listing system users (GET /api/admin/system/users)."
            );
        }
    }

    public function test_allowed_roles_can_show_system_user(): void
    {
        $targetUser = User::factory()->create();
        $targetUser->assignRole('staff');

        foreach (self::ALLOWED_ROLES as $role) {
            $this->actingAsRole($role);

            $response = $this->getJson("/api/admin/system/users/{$targetUser->id}");

            $response->assertOk(
                "Role '{$role}' must be permitted to view system user (GET /api/admin/system/users/{$targetUser->id})."
            );
        }
    }

    public function test_blocked_roles_cannot_show_system_user(): void
    {
        $targetUser = User::factory()->create();
        $targetUser->assignRole('staff');

        foreach (self::BLOCKED_ROLES as $role) {
            $this->actingAsRole($role);

            $response = $this->getJson("/api/admin/system/users/{$targetUser->id}");

            $response->assertForbidden(
                "Role '{$role}' must be forbidden from viewing system user (GET /api/admin/system/users/{$targetUser->id})."
            );
        }
    }

    public function test_allowed_roles_can_create_system_user(): void
    {
        foreach (self::ALLOWED_ROLES as $role) {
            $this->actingAsRole($role);

            $email = "sys_user_{$role}_".uniqid().'@example.com';
            $response = $this->postJson('/api/admin/system/users', [
                'name' => "System User {$role}",
                'email' => $email,
                'password' => 'Password123!',
                'roles' => ['staff'],
            ]);

            $response->assertCreated(
                "Role '{$role}' must be permitted to create system user (POST /api/admin/system/users)."
            );
            $this->assertDatabaseHas('users', ['email' => $email]);
        }
    }

    public function test_blocked_roles_cannot_create_system_user(): void
    {
        foreach (self::BLOCKED_ROLES as $role) {
            $this->actingAsRole($role);

            $email = "blocked_sys_user_{$role}_".uniqid().'@example.com';
            $response = $this->postJson('/api/admin/system/users', [
                'name' => "Blocked User {$role}",
                'email' => $email,
                'password' => 'Password123!',
                'roles' => ['staff'],
            ]);

            $response->assertForbidden(
                "Role '{$role}' must be forbidden from creating system user (POST /api/admin/system/users)."
            );
            $this->assertDatabaseMissing('users', ['email' => $email]);
        }
    }

    public function test_allowed_roles_can_update_system_user(): void
    {
        foreach (self::ALLOWED_ROLES as $role) {
            $actor = $this->actingAsRole($role);

            $targetUser = User::factory()->create();
            $targetUser->assignRole('staff');

            $updatedName = "Updated by {$role}";
            $response = $this->putJson("/api/admin/system/users/{$targetUser->id}", [
                'name' => $updatedName,
                'email' => $targetUser->email,
                'roles' => ['staff'],
            ]);

            $response->assertOk(
                "Role '{$role}' must be permitted to update system user (PUT /api/admin/system/users/{$targetUser->id})."
            );
            $this->assertDatabaseHas('users', [
                'id' => $targetUser->id,
                'name' => $updatedName,
            ]);
        }
    }

    public function test_blocked_roles_cannot_update_system_user(): void
    {
        $targetUser = User::factory()->create(['name' => 'Original Sys User']);
        $targetUser->assignRole('staff');

        foreach (self::BLOCKED_ROLES as $role) {
            $this->actingAsRole($role);

            $response = $this->putJson("/api/admin/system/users/{$targetUser->id}", [
                'name' => "Hacked by {$role}",
                'email' => $targetUser->email,
                'roles' => ['staff'],
            ]);

            $response->assertForbidden(
                "Role '{$role}' must be forbidden from updating system user (PUT /api/admin/system/users/{$targetUser->id})."
            );
            $this->assertDatabaseHas('users', [
                'id' => $targetUser->id,
                'name' => 'Original Sys User',
            ]);
        }
    }

    public function test_allowed_roles_can_delete_system_user(): void
    {
        foreach (self::ALLOWED_ROLES as $role) {
            $this->actingAsRole($role);

            $targetUser = User::factory()->create();
            $targetUser->assignRole('staff');

            $response = $this->deleteJson("/api/admin/system/users/{$targetUser->id}");

            $response->assertNoContent();
            $this->assertDatabaseMissing('users', ['id' => $targetUser->id]);
        }
    }

    public function test_blocked_roles_cannot_delete_system_user(): void
    {
        $targetUser = User::factory()->create();
        $targetUser->assignRole('staff');

        foreach (self::BLOCKED_ROLES as $role) {
            $this->actingAsRole($role);

            $response = $this->deleteJson("/api/admin/system/users/{$targetUser->id}");

            $response->assertForbidden(
                "Role '{$role}' must be forbidden from deleting system user (DELETE /api/admin/system/users/{$targetUser->id})."
            );
            $this->assertDatabaseHas('users', ['id' => $targetUser->id]);
        }
    }

    public function test_migration_seeds_and_assigns_system_user_permissions_to_core_roles_only(): void
    {
        $migration = require database_path('migrations/2026_09_22_000006_seed_system_users_domain_permissions.php');
        $migration->up();

        $admin = Role::query()->where('name', 'admin')->where('guard_name', 'web')->first();
        $this->assertNotNull($admin);

        foreach (AdminAbilityRegistry::SYSTEM_USERS as $permission) {
            $this->assertTrue(
                $admin->hasPermissionTo($permission),
                "Admin must have permission '{$permission}' after migration."
            );
        }

        foreach (['Product Manager', 'Order Manager', 'Support'] as $businessRole) {
            $role = Role::query()->where('name', $businessRole)->where('guard_name', 'web')->first();
            $this->assertNotNull($role);

            foreach (AdminAbilityRegistry::SYSTEM_USERS as $permission) {
                $this->assertFalse(
                    $role->hasPermissionTo($permission),
                    "Business role '{$businessRole}' must NOT have permission '{$permission}'."
                );
            }
        }
    }

    public function test_unauthenticated_request_is_unauthorized(): void
    {
        $targetUser = User::factory()->create();
        $targetUser->assignRole('staff');

        $this->getJson('/api/admin/system/users')->assertUnauthorized();
        $this->postJson('/api/admin/system/users', ['name' => 'Guest'])->assertUnauthorized();
        $this->getJson("/api/admin/system/users/{$targetUser->id}")->assertUnauthorized();
        $this->putJson("/api/admin/system/users/{$targetUser->id}", ['name' => 'Guest'])->assertUnauthorized();
        $this->deleteJson("/api/admin/system/users/{$targetUser->id}")->assertUnauthorized();
    }

    private function actingAsRole(string $role): User
    {
        $user = User::factory()->create();
        $user->assignRole($role);
        Sanctum::actingAs($user);

        return $user;
    }
}
