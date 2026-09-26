<?php

declare(strict_types=1);

namespace Tests\Feature\Api\Admin;

use App\Models\User;
use App\Security\AdminAbilityRegistry;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Lunar\Models\CollectionGroup;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

/**
 * Parity test suite for Phase 6b: Collection Groups Domain Migration.
 *
 * Verifies exact 100% status code parity across all 7 roles and all collection group actions:
 * - Allowed (super_admin, admin, staff, Product Manager): 200, 201, 204.
 * - Blocked (Order Manager, Support, customer): 403 Forbidden.
 */
class CollectionGroupsAbilityParityTest extends TestCase
{
    use RefreshDatabase;

    private const ALLOWED_ROLES = [
        'super_admin',
        'admin',
        'staff',
        'Product Manager',
    ];

    private const BLOCKED_ROLES = [
        'Order Manager',
        'Support',
        'customer',
    ];

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
    }

    public function test_allowed_roles_can_list_collection_groups(): void
    {
        CollectionGroup::query()->create([
            'name' => 'Parity Group Alpha',
            'handle' => 'parity-group-alpha',
        ]);

        foreach (self::ALLOWED_ROLES as $role) {
            $this->actingAsRole($role);

            $response = $this->getJson('/api/admin/collection-groups');

            $response->assertOk(
                "Role '{$role}' must be permitted to list collection groups (GET /api/admin/collection-groups)."
            );
        }
    }

    public function test_blocked_roles_cannot_list_collection_groups(): void
    {
        CollectionGroup::query()->create([
            'name' => 'Parity Group Alpha',
            'handle' => 'parity-group-alpha',
        ]);

        foreach (self::BLOCKED_ROLES as $role) {
            $this->actingAsRole($role);

            $response = $this->getJson('/api/admin/collection-groups');

            $response->assertForbidden(
                "Role '{$role}' must be forbidden from listing collection groups (GET /api/admin/collection-groups)."
            );
        }
    }

    public function test_allowed_roles_can_show_collection_group(): void
    {
        $group = CollectionGroup::query()->create([
            'name' => 'Parity Group Show',
            'handle' => 'parity-group-show',
        ]);

        foreach (self::ALLOWED_ROLES as $role) {
            $this->actingAsRole($role);

            $response = $this->getJson("/api/admin/collection-groups/{$group->id}");

            $response->assertOk(
                "Role '{$role}' must be permitted to show collection group (GET /api/admin/collection-groups/{$group->id})."
            );
            $response->assertJsonPath('data.name', 'Parity Group Show');
        }
    }

    public function test_blocked_roles_cannot_show_collection_group(): void
    {
        $group = CollectionGroup::query()->create([
            'name' => 'Parity Group Show',
            'handle' => 'parity-group-show',
        ]);

        foreach (self::BLOCKED_ROLES as $role) {
            $this->actingAsRole($role);

            $response = $this->getJson("/api/admin/collection-groups/{$group->id}");

            $response->assertForbidden(
                "Role '{$role}' must be forbidden from showing collection group (GET /api/admin/collection-groups/{$group->id})."
            );
        }
    }

    public function test_allowed_roles_can_create_collection_group(): void
    {
        $counter = 1;
        foreach (self::ALLOWED_ROLES as $role) {
            $this->actingAsRole($role);

            $groupName = "Group Created By {$role} {$counter}";
            $groupHandle = 'group-created-by-'.strtolower(str_replace(' ', '-', $role))."-{$counter}";
            $counter++;

            $response = $this->postJson('/api/admin/collection-groups', [
                'name' => $groupName,
                'handle' => $groupHandle,
            ]);

            $response->assertCreated(
                "Role '{$role}' must be permitted to create collection group (POST /api/admin/collection-groups)."
            );
            $response->assertJsonPath('data.name', $groupName);

            $this->assertDatabaseHas('lunar_collection_groups', [
                'name' => $groupName,
                'handle' => $groupHandle,
            ]);
        }
    }

    public function test_blocked_roles_cannot_create_collection_group(): void
    {
        $counter = 1;
        foreach (self::BLOCKED_ROLES as $role) {
            $this->actingAsRole($role);

            $groupName = "Unauthorized Group {$role} {$counter}";
            $groupHandle = 'unauthorized-group-'.strtolower(str_replace(' ', '-', $role))."-{$counter}";
            $counter++;

            $response = $this->postJson('/api/admin/collection-groups', [
                'name' => $groupName,
                'handle' => $groupHandle,
            ]);

            $response->assertForbidden(
                "Role '{$role}' must be forbidden from creating collection group (POST /api/admin/collection-groups)."
            );

            $this->assertDatabaseMissing('lunar_collection_groups', [
                'name' => $groupName,
            ]);
        }
    }

    public function test_allowed_roles_can_update_collection_group(): void
    {
        $group = CollectionGroup::query()->create([
            'name' => 'Initial Group Update Name',
            'handle' => 'initial-group-update-name',
        ]);
        $counter = 1;

        foreach (self::ALLOWED_ROLES as $role) {
            $this->actingAsRole($role);

            $newName = "Group Updated By {$role} {$counter}";
            $newHandle = 'group-updated-by-'.strtolower(str_replace(' ', '-', $role))."-{$counter}";
            $counter++;

            $response = $this->putJson("/api/admin/collection-groups/{$group->id}", [
                'name' => $newName,
                'handle' => $newHandle,
            ]);

            $response->assertOk(
                "Role '{$role}' must be permitted to update collection group (PUT /api/admin/collection-groups/{$group->id})."
            );
            $response->assertJsonPath('data.name', $newName);

            $this->assertDatabaseHas('lunar_collection_groups', [
                'id' => $group->id,
                'name' => $newName,
                'handle' => $newHandle,
            ]);
        }
    }

    public function test_blocked_roles_cannot_update_collection_group(): void
    {
        $group = CollectionGroup::query()->create([
            'name' => 'Initial Group Protected Name',
            'handle' => 'initial-group-protected-name',
        ]);

        foreach (self::BLOCKED_ROLES as $role) {
            $this->actingAsRole($role);

            $response = $this->putJson("/api/admin/collection-groups/{$group->id}", [
                'name' => "Tampered By {$role}",
                'handle' => 'tampered-by-'.strtolower(str_replace(' ', '-', $role)),
            ]);

            $response->assertForbidden(
                "Role '{$role}' must be forbidden from updating collection group (PUT /api/admin/collection-groups/{$group->id})."
            );

            $this->assertDatabaseHas('lunar_collection_groups', [
                'id' => $group->id,
                'name' => 'Initial Group Protected Name',
            ]);
        }
    }

    public function test_allowed_roles_can_delete_collection_group(): void
    {
        $counter = 1;
        foreach (self::ALLOWED_ROLES as $role) {
            $this->actingAsRole($role);

            $group = CollectionGroup::query()->create([
                'name' => "Group To Delete By {$role} {$counter}",
                'handle' => 'group-to-delete-by-'.strtolower(str_replace(' ', '-', $role))."-{$counter}",
            ]);
            $counter++;

            $response = $this->deleteJson("/api/admin/collection-groups/{$group->id}");

            $response->assertNoContent();

            $this->assertDatabaseMissing('lunar_collection_groups', [
                'id' => $group->id,
            ]);
        }
    }

    public function test_blocked_roles_cannot_delete_collection_group(): void
    {
        $group = CollectionGroup::query()->create([
            'name' => 'Group Protected From Deletion',
            'handle' => 'group-protected-from-deletion',
        ]);

        foreach (self::BLOCKED_ROLES as $role) {
            $this->actingAsRole($role);

            $response = $this->deleteJson("/api/admin/collection-groups/{$group->id}");

            $response->assertForbidden(
                "Role '{$role}' must be forbidden from deleting collection group (DELETE /api/admin/collection-groups/{$group->id})."
            );

            $this->assertDatabaseHas('lunar_collection_groups', [
                'id' => $group->id,
            ]);
        }
    }

    public function test_migration_seeds_and_assigns_collection_group_permissions_to_existing_product_manager(): void
    {
        $migration = require database_path('migrations/2026_09_20_000001_seed_collection_groups_domain_permissions.php');
        $migration->up();

        $pm = Role::query()->where('name', 'Product Manager')->where('guard_name', 'web')->first();
        $this->assertNotNull($pm);

        foreach (AdminAbilityRegistry::COLLECTION_GROUPS as $permission) {
            $this->assertTrue(
                $pm->hasPermissionTo($permission),
                "Product Manager must have permission '{$permission}' after migration."
            );
        }
    }

    public function test_unauthenticated_request_is_unauthorized_for_all_endpoints(): void
    {
        $group = CollectionGroup::query()->create([
            'name' => 'Guest Group',
            'handle' => 'guest-group',
        ]);

        $this->getJson('/api/admin/collection-groups')->assertUnauthorized();
        $this->postJson('/api/admin/collection-groups', [
            'name' => 'Guest New',
            'handle' => 'guest-new',
        ])->assertUnauthorized();
        $this->getJson("/api/admin/collection-groups/{$group->id}")->assertUnauthorized();
        $this->putJson("/api/admin/collection-groups/{$group->id}", [
            'name' => 'Guest Edit',
            'handle' => 'guest-edit',
        ])->assertUnauthorized();
        $this->deleteJson("/api/admin/collection-groups/{$group->id}")->assertUnauthorized();
    }

    private function actingAsRole(string $role): User
    {
        $user = User::factory()->create();
        $user->assignRole($role);
        Sanctum::actingAs($user);

        return $user;
    }
}
