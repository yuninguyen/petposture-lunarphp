<?php

declare(strict_types=1);

namespace Tests\Feature\Api\Admin;

use App\Models\AffiliateNetwork;
use App\Models\User;
use App\Security\AdminAbilityRegistry;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

/**
 * Parity test suite for Phase 6b: Affiliate Networks Selector Domain Migration.
 *
 * Verifies exact 100% status code parity across all 7 roles for:
 * - GET /api/admin/affiliate-networks (view_affiliate_network_selector)
 *
 * Note: Distinct from /api/admin/affiliate/networks (CRUD in AFFILIATE_NETWORKS domain).
 */
class AffiliateNetworksSelectorAbilityParityTest extends TestCase
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

    public function test_allowed_roles_can_list_affiliate_networks_selector(): void
    {
        AffiliateNetwork::query()->create([
            'name' => 'Amazon Associates',
            'slug' => 'amazon-associates',
            'active' => true,
        ]);

        foreach (self::ALLOWED_ROLES as $role) {
            $this->actingAsRole($role);

            $response = $this->getJson('/api/admin/affiliate-networks');

            $response->assertOk(
                "Role '{$role}' must be permitted to view affiliate networks selector (GET /api/admin/affiliate-networks)."
            );
        }
    }

    public function test_blocked_roles_cannot_list_affiliate_networks_selector(): void
    {
        AffiliateNetwork::query()->create([
            'name' => 'Amazon Associates',
            'slug' => 'amazon-associates',
            'active' => true,
        ]);

        foreach (self::BLOCKED_ROLES as $role) {
            $this->actingAsRole($role);

            $response = $this->getJson('/api/admin/affiliate-networks');

            $response->assertForbidden(
                "Role '{$role}' must be forbidden from viewing affiliate networks selector (GET /api/admin/affiliate-networks)."
            );
        }
    }

    public function test_migration_seeds_and_assigns_affiliate_networks_selector_permissions_to_core_roles_only(): void
    {
        $migration = require database_path('migrations/2026_09_21_000006_seed_affiliate_networks_selector_domain_permissions.php');
        $migration->up();

        $admin = Role::query()->where('name', 'admin')->where('guard_name', 'web')->first();
        $this->assertNotNull($admin);

        foreach (AdminAbilityRegistry::AFFILIATE_NETWORKS_SELECTOR as $permission) {
            $this->assertTrue(
                $admin->hasPermissionTo($permission),
                "Admin must have permission '{$permission}' after migration."
            );
        }

        foreach (['Product Manager', 'Order Manager', 'Support'] as $businessRole) {
            $role = Role::query()->where('name', $businessRole)->where('guard_name', 'web')->first();
            $this->assertNotNull($role);

            foreach (AdminAbilityRegistry::AFFILIATE_NETWORKS_SELECTOR as $permission) {
                $this->assertFalse(
                    $role->hasPermissionTo($permission),
                    "Business role '{$businessRole}' must NOT have permission '{$permission}'."
                );
            }
        }
    }

    public function test_unauthenticated_request_is_unauthorized(): void
    {
        $this->getJson('/api/admin/affiliate-networks')->assertUnauthorized();
    }

    private function actingAsRole(string $role): User
    {
        $user = User::factory()->create();
        $user->assignRole($role);
        Sanctum::actingAs($user);

        return $user;
    }
}
