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
 * Parity test suite for Phase 6b: Dashboard Conversion Domain Migration (Group B).
 *
 * Verifies exact 100% status code parity across all 7 roles for:
 * - GET /api/admin/dashboard/conversion (view_dashboard_conversion)
 *
 * - Allowed: super_admin, admin, staff, Order Manager, Support (200 OK).
 * - Blocked: Product Manager, customer (403 Forbidden).
 */
class DashboardConversionAbilityParityTest extends TestCase
{
    use RefreshDatabase;

    private const ALLOWED_ROLES = [
        'super_admin',
        'admin',
        'staff',
        'Order Manager',
        'Support',
    ];

    private const BLOCKED_ROLES = [
        'Product Manager',
        'customer',
    ];

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
    }

    public function test_allowed_roles_can_access_dashboard_conversion(): void
    {
        foreach (self::ALLOWED_ROLES as $role) {
            $this->actingAsRole($role);

            $response = $this->getJson('/api/admin/dashboard/conversion');

            $response->assertOk(
                "Role '{$role}' must be permitted to view dashboard conversion (GET /api/admin/dashboard/conversion)."
            );
        }
    }

    public function test_blocked_roles_cannot_access_dashboard_conversion(): void
    {
        foreach (self::BLOCKED_ROLES as $role) {
            $this->actingAsRole($role);

            $response = $this->getJson('/api/admin/dashboard/conversion');

            $response->assertForbidden(
                "Role '{$role}' must be forbidden from viewing dashboard conversion (GET /api/admin/dashboard/conversion)."
            );
        }
    }

    public function test_migration_seeds_and_assigns_dashboard_conversion_permissions(): void
    {
        $migration = require database_path('migrations/2026_09_22_000009_seed_dashboard_conversion_domain_permissions.php');
        $migration->up();

        // Core roles, Order Manager, and Support MUST have permission
        foreach (['admin', 'staff', 'Order Manager', 'Support'] as $roleName) {
            $role = Role::query()->where('name', $roleName)->where('guard_name', 'web')->first();
            $this->assertNotNull($role);

            foreach (AdminAbilityRegistry::DASHBOARD_CONVERSION as $permission) {
                $this->assertTrue(
                    $role->hasPermissionTo($permission),
                    "Role '{$roleName}' must have permission '{$permission}'."
                );
            }
        }

        // Product Manager MUST NOT have permission
        $pm = Role::query()->where('name', 'Product Manager')->where('guard_name', 'web')->first();
        $this->assertNotNull($pm);

        foreach (AdminAbilityRegistry::DASHBOARD_CONVERSION as $permission) {
            $this->assertFalse(
                $pm->hasPermissionTo($permission),
                "Product Manager must NOT have permission '{$permission}'."
            );
        }
    }

    public function test_unauthenticated_request_is_unauthorized(): void
    {
        $this->getJson('/api/admin/dashboard/conversion')->assertUnauthorized();
    }

    private function actingAsRole(string $role): User
    {
        $user = User::factory()->create();
        $user->assignRole($role);
        Sanctum::actingAs($user);

        return $user;
    }
}
