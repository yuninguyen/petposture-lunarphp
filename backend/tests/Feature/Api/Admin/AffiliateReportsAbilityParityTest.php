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
 * Parity test suite for Phase 6b: Affiliate Reports Domain Migration.
 *
 * Verifies exact 100% status code parity across all 7 roles for:
 * - GET /api/admin/affiliate/reports (view_any_affiliate_report)
 *
 * - Allowed (super_admin, admin, staff): 200 OK.
 * - Blocked (Product Manager, Order Manager, Support, customer): 403 Forbidden.
 */
class AffiliateReportsAbilityParityTest extends TestCase
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

    public function test_allowed_roles_can_list_affiliate_reports(): void
    {
        foreach (self::ALLOWED_ROLES as $role) {
            $this->actingAsRole($role);

            $response = $this->getJson('/api/admin/affiliate/reports');

            $response->assertOk(
                "Role '{$role}' must be permitted to view affiliate reports (GET /api/admin/affiliate/reports)."
            );
        }
    }

    public function test_blocked_roles_cannot_list_affiliate_reports(): void
    {
        foreach (self::BLOCKED_ROLES as $role) {
            $this->actingAsRole($role);

            $response = $this->getJson('/api/admin/affiliate/reports');

            $response->assertForbidden(
                "Role '{$role}' must be forbidden from viewing affiliate reports (GET /api/admin/affiliate/reports)."
            );
        }
    }

    public function test_migration_seeds_and_assigns_affiliate_report_permissions_to_core_roles_only(): void
    {
        $migration = require database_path('migrations/2026_09_22_000004_seed_affiliate_reports_domain_permissions.php');
        $migration->up();

        $admin = Role::query()->where('name', 'admin')->where('guard_name', 'web')->first();
        $this->assertNotNull($admin);

        foreach (AdminAbilityRegistry::AFFILIATE_REPORTS as $permission) {
            $this->assertTrue(
                $admin->hasPermissionTo($permission),
                "Admin must have permission '{$permission}' after migration."
            );
        }

        foreach (['Product Manager', 'Order Manager', 'Support'] as $businessRole) {
            $role = Role::query()->where('name', $businessRole)->where('guard_name', 'web')->first();
            $this->assertNotNull($role);

            foreach (AdminAbilityRegistry::AFFILIATE_REPORTS as $permission) {
                $this->assertFalse(
                    $role->hasPermissionTo($permission),
                    "Business role '{$businessRole}' must NOT have permission '{$permission}'."
                );
            }
        }
    }

    public function test_unauthenticated_request_is_unauthorized(): void
    {
        $this->getJson('/api/admin/affiliate/reports')->assertUnauthorized();
    }

    private function actingAsRole(string $role): User
    {
        $user = User::factory()->create();
        $user->assignRole($role);
        Sanctum::actingAs($user);

        return $user;
    }
}
