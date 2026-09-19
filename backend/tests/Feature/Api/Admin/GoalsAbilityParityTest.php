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
 * Parity test suite for Phase 6b: Goals Domain Migration.
 *
 * Verifies exact 100% status code parity across all 7 roles for the goals endpoints:
 * - GET /api/admin/goals (view_any_goal)
 * - PUT /api/admin/goals (update_goal)
 *
 * - Allowed (super_admin, admin, staff): 200 OK.
 * - Blocked (Product Manager, Order Manager, Support, customer): 403 Forbidden.
 */
class GoalsAbilityParityTest extends TestCase
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

    public function test_allowed_roles_can_list_goals(): void
    {
        foreach (self::ALLOWED_ROLES as $role) {
            $this->actingAsRole($role);

            $response = $this->getJson('/api/admin/goals');

            $response->assertOk(
                "Role '{$role}' must be permitted to view goals (GET /api/admin/goals)."
            );
            $response->assertJsonStructure(['data' => ['goals']]);
        }
    }

    public function test_blocked_roles_cannot_list_goals(): void
    {
        foreach (self::BLOCKED_ROLES as $role) {
            $this->actingAsRole($role);

            $response = $this->getJson('/api/admin/goals');

            $response->assertForbidden(
                "Role '{$role}' must be forbidden from viewing goals (GET /api/admin/goals)."
            );
        }
    }

    public function test_allowed_roles_can_update_goals(): void
    {
        foreach (self::ALLOWED_ROLES as $role) {
            $this->actingAsRole($role);

            $target = rand(1000, 9999);
            $response = $this->putJson('/api/admin/goals', [
                'monthly_revenue_target' => $target,
            ]);

            $response->assertOk(
                "Role '{$role}' must be permitted to update goals (PUT /api/admin/goals)."
            );
            $this->assertDatabaseHas('settings', [
                'key' => 'monthly_revenue_target',
                'value' => (string) $target,
                'group' => 'goals',
            ]);
        }
    }

    public function test_blocked_roles_cannot_update_goals(): void
    {
        foreach (self::BLOCKED_ROLES as $role) {
            $this->actingAsRole($role);

            $response = $this->putJson('/api/admin/goals', [
                'monthly_revenue_target' => 99999,
            ]);

            $response->assertForbidden(
                "Role '{$role}' must be forbidden from updating goals (PUT /api/admin/goals)."
            );
        }
    }

    public function test_migration_seeds_and_assigns_goals_permissions_to_core_roles_only(): void
    {
        $migration = require database_path('migrations/2026_09_22_000001_seed_goals_domain_permissions.php');
        $migration->up();

        $admin = Role::query()->where('name', 'admin')->where('guard_name', 'web')->first();
        $this->assertNotNull($admin);

        foreach (AdminAbilityRegistry::GOALS as $permission) {
            $this->assertTrue(
                $admin->hasPermissionTo($permission),
                "Admin must have permission '{$permission}' after migration."
            );
        }

        foreach (['Product Manager', 'Order Manager', 'Support'] as $businessRole) {
            $role = Role::query()->where('name', $businessRole)->where('guard_name', 'web')->first();
            $this->assertNotNull($role);

            foreach (AdminAbilityRegistry::GOALS as $permission) {
                $this->assertFalse(
                    $role->hasPermissionTo($permission),
                    "Business role '{$businessRole}' must NOT have permission '{$permission}'."
                );
            }
        }
    }

    public function test_unauthenticated_request_is_unauthorized(): void
    {
        $this->getJson('/api/admin/goals')->assertUnauthorized();
        $this->putJson('/api/admin/goals', [
            'monthly_revenue_target' => 1000,
        ])->assertUnauthorized();
    }

    private function actingAsRole(string $role): User
    {
        $user = User::factory()->create();
        $user->assignRole($role);
        Sanctum::actingAs($user);

        return $user;
    }
}
