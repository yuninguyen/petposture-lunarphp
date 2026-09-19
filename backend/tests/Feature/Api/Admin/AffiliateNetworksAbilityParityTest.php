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
 * Parity test suite for Phase 6b: Affiliate Networks Domain Migration.
 *
 * Verifies exact 100% status code parity across all 7 roles for /affiliate/networks endpoints:
 * - GET /api/admin/affiliate/networks (view_any_affiliate_network)
 * - POST /api/admin/affiliate/networks (create_affiliate_network)
 * - GET /api/admin/affiliate/networks/{network} (view_affiliate_network)
 * - PUT /api/admin/affiliate/networks/{network} (update_affiliate_network)
 * - DELETE /api/admin/affiliate/networks/{network} (delete_affiliate_network)
 * - POST /api/admin/affiliate/networks/{network}/sync (sync_affiliate_network)
 *
 * Note: Distinct from /api/admin/affiliate-networks (AFFILIATE_NETWORKS_SELECTOR domain).
 */
class AffiliateNetworksAbilityParityTest extends TestCase
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

    public function test_allowed_roles_can_list_affiliate_networks(): void
    {
        AffiliateNetwork::query()->create([
            'name' => 'Network Alpha',
            'slug' => 'network-alpha',
            'active' => true,
        ]);

        foreach (self::ALLOWED_ROLES as $role) {
            $this->actingAsRole($role);

            $response = $this->getJson('/api/admin/affiliate/networks');

            $response->assertOk(
                "Role '{$role}' must be permitted to list affiliate networks (GET /api/admin/affiliate/networks)."
            );
        }
    }

    public function test_blocked_roles_cannot_list_affiliate_networks(): void
    {
        AffiliateNetwork::query()->create([
            'name' => 'Network Alpha',
            'slug' => 'network-alpha',
            'active' => true,
        ]);

        foreach (self::BLOCKED_ROLES as $role) {
            $this->actingAsRole($role);

            $response = $this->getJson('/api/admin/affiliate/networks');

            $response->assertForbidden(
                "Role '{$role}' must be forbidden from listing affiliate networks (GET /api/admin/affiliate/networks)."
            );
        }
    }

    public function test_allowed_roles_can_show_affiliate_network(): void
    {
        $network = AffiliateNetwork::query()->create([
            'name' => 'Show Network',
            'slug' => 'show-network',
            'active' => true,
        ]);

        foreach (self::ALLOWED_ROLES as $role) {
            $this->actingAsRole($role);

            $response = $this->getJson("/api/admin/affiliate/networks/{$network->id}");

            $response->assertOk(
                "Role '{$role}' must be permitted to view affiliate network (GET /api/admin/affiliate/networks/{$network->id})."
            );
            $response->assertJsonPath('data.name', 'Show Network');
        }
    }

    public function test_blocked_roles_cannot_show_affiliate_network(): void
    {
        $network = AffiliateNetwork::query()->create([
            'name' => 'Show Network',
            'slug' => 'show-network',
            'active' => true,
        ]);

        foreach (self::BLOCKED_ROLES as $role) {
            $this->actingAsRole($role);

            $response = $this->getJson("/api/admin/affiliate/networks/{$network->id}");

            $response->assertForbidden(
                "Role '{$role}' must be forbidden from viewing affiliate network (GET /api/admin/affiliate/networks/{$network->id})."
            );
        }
    }

    public function test_allowed_roles_can_create_affiliate_network(): void
    {
        foreach (self::ALLOWED_ROLES as $role) {
            $this->actingAsRole($role);

            $name = "Network {$role}";
            $response = $this->postJson('/api/admin/affiliate/networks', [
                'name' => $name,
            ]);

            $response->assertCreated(
                "Role '{$role}' must be permitted to create affiliate network (POST /api/admin/affiliate/networks)."
            );
            $this->assertDatabaseHas('affiliate_networks', ['name' => $name]);
        }
    }

    public function test_blocked_roles_cannot_create_affiliate_network(): void
    {
        foreach (self::BLOCKED_ROLES as $role) {
            $this->actingAsRole($role);

            $name = "Blocked Network {$role}";
            $response = $this->postJson('/api/admin/affiliate/networks', [
                'name' => $name,
            ]);

            $response->assertForbidden(
                "Role '{$role}' must be forbidden from creating affiliate network (POST /api/admin/affiliate/networks)."
            );
            $this->assertDatabaseMissing('affiliate_networks', ['name' => $name]);
        }
    }

    public function test_allowed_roles_can_update_affiliate_network(): void
    {
        $network = AffiliateNetwork::query()->create([
            'name' => 'Original Network',
            'slug' => 'original-network',
            'active' => true,
        ]);

        foreach (self::ALLOWED_ROLES as $role) {
            $this->actingAsRole($role);

            $updatedName = "Updated by {$role}";
            $response = $this->putJson("/api/admin/affiliate/networks/{$network->id}", [
                'name' => $updatedName,
            ]);

            $response->assertOk(
                "Role '{$role}' must be permitted to update affiliate network (PUT /api/admin/affiliate/networks/{$network->id})."
            );
            $this->assertDatabaseHas('affiliate_networks', [
                'id' => $network->id,
                'name' => $updatedName,
            ]);
        }
    }

    public function test_blocked_roles_cannot_update_affiliate_network(): void
    {
        $network = AffiliateNetwork::query()->create([
            'name' => 'Original Network Blocked',
            'slug' => 'original-network-blocked',
            'active' => true,
        ]);

        foreach (self::BLOCKED_ROLES as $role) {
            $this->actingAsRole($role);

            $response = $this->putJson("/api/admin/affiliate/networks/{$network->id}", [
                'name' => "Hacked by {$role}",
            ]);

            $response->assertForbidden(
                "Role '{$role}' must be forbidden from updating affiliate network (PUT /api/admin/affiliate/networks/{$network->id})."
            );
            $this->assertDatabaseHas('affiliate_networks', [
                'id' => $network->id,
                'name' => 'Original Network Blocked',
            ]);
        }
    }

    public function test_allowed_roles_can_delete_affiliate_network(): void
    {
        foreach (self::ALLOWED_ROLES as $role) {
            $network = AffiliateNetwork::query()->create([
                'name' => "Delete Network {$role}",
                'slug' => "delete-network-{$role}",
                'active' => true,
            ]);

            $this->actingAsRole($role);

            $response = $this->deleteJson("/api/admin/affiliate/networks/{$network->id}");

            $response->assertOk(
                "Role '{$role}' must be permitted to delete affiliate network (DELETE /api/admin/affiliate/networks/{$network->id})."
            );
            $this->assertDatabaseMissing('affiliate_networks', ['id' => $network->id]);
        }
    }

    public function test_blocked_roles_cannot_delete_affiliate_network(): void
    {
        $network = AffiliateNetwork::query()->create([
            'name' => 'Protected Network',
            'slug' => 'protected-network',
            'active' => true,
        ]);

        foreach (self::BLOCKED_ROLES as $role) {
            $this->actingAsRole($role);

            $response = $this->deleteJson("/api/admin/affiliate/networks/{$network->id}");

            $response->assertForbidden(
                "Role '{$role}' must be forbidden from deleting affiliate network (DELETE /api/admin/affiliate/networks/{$network->id})."
            );
            $this->assertDatabaseHas('affiliate_networks', ['id' => $network->id]);
        }
    }

    public function test_allowed_roles_can_trigger_sync_and_blocked_roles_are_forbidden(): void
    {
        $network = AffiliateNetwork::query()->create([
            'name' => 'Sync Network',
            'slug' => 'sync-network',
            'active' => true,
        ]);

        foreach (self::ALLOWED_ROLES as $role) {
            $this->actingAsRole($role);

            $response = $this->postJson("/api/admin/affiliate/networks/{$network->id}/sync");

            // Since api credentials are not set, it passes auth/ability check and returns 422 unprocessable
            $this->assertNotEquals(403, $response->getStatusCode(), "Role '{$role}' should not be 403.");
            $response->assertUnprocessable();
        }

        foreach (self::BLOCKED_ROLES as $role) {
            $this->actingAsRole($role);

            $response = $this->postJson("/api/admin/affiliate/networks/{$network->id}/sync");

            $response->assertForbidden("Role '{$role}' must be forbidden.");
        }
    }

    public function test_migration_seeds_and_assigns_affiliate_network_permissions_to_core_roles_only(): void
    {
        $migration = require database_path('migrations/2026_09_22_000007_seed_affiliate_networks_domain_permissions.php');
        $migration->up();

        $admin = Role::query()->where('name', 'admin')->where('guard_name', 'web')->first();
        $this->assertNotNull($admin);

        foreach (AdminAbilityRegistry::AFFILIATE_NETWORKS as $permission) {
            $this->assertTrue(
                $admin->hasPermissionTo($permission),
                "Admin must have permission '{$permission}' after migration."
            );
        }

        foreach (['Product Manager', 'Order Manager', 'Support'] as $businessRole) {
            $role = Role::query()->where('name', $businessRole)->where('guard_name', 'web')->first();
            $this->assertNotNull($role);

            foreach (AdminAbilityRegistry::AFFILIATE_NETWORKS as $permission) {
                $this->assertFalse(
                    $role->hasPermissionTo($permission),
                    "Business role '{$businessRole}' must NOT have permission '{$permission}'."
                );
            }
        }
    }

    public function test_unauthenticated_request_is_unauthorized(): void
    {
        $network = AffiliateNetwork::query()->create([
            'name' => 'Guest Network',
            'slug' => 'guest-network',
            'active' => true,
        ]);

        $this->getJson('/api/admin/affiliate/networks')->assertUnauthorized();
        $this->postJson('/api/admin/affiliate/networks', ['name' => 'Guest'])->assertUnauthorized();
        $this->getJson("/api/admin/affiliate/networks/{$network->id}")->assertUnauthorized();
        $this->putJson("/api/admin/affiliate/networks/{$network->id}", ['name' => 'Guest'])->assertUnauthorized();
        $this->deleteJson("/api/admin/affiliate/networks/{$network->id}")->assertUnauthorized();
        $this->postJson("/api/admin/affiliate/networks/{$network->id}/sync")->assertUnauthorized();
    }

    private function actingAsRole(string $role): User
    {
        $user = User::factory()->create();
        $user->assignRole($role);
        Sanctum::actingAs($user);

        return $user;
    }
}
