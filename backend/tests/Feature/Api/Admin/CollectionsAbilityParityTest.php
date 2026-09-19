<?php

declare(strict_types=1);

namespace Tests\Feature\Api\Admin;

use App\Models\User;
use App\Security\AdminAbilityRegistry;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Lunar\FieldTypes\TranslatedText;
use Lunar\Models\Collection;
use Lunar\Models\CollectionGroup;
use Lunar\Models\Product;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

/**
 * Parity test suite for Phase 6b: Collections Domain Migration.
 *
 * Verifies exact 100% status code parity across all 7 roles and all collection actions:
 * - Allowed (super_admin, admin, staff, Product Manager): 200, 201, 204.
 * - Blocked (Order Manager, Support, customer): 403 Forbidden.
 */
class CollectionsAbilityParityTest extends TestCase
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

    public function test_allowed_roles_can_list_collections(): void
    {
        $group = CollectionGroup::factory()->create();
        $this->createCollection($group, 'Alpha Collection');

        foreach (self::ALLOWED_ROLES as $role) {
            $this->actingAsRole($role);

            $response = $this->getJson('/api/admin/collections');

            $response->assertOk(
                "Role '{$role}' must be permitted to list collections (GET /api/admin/collections)."
            );
        }
    }

    public function test_blocked_roles_cannot_list_collections(): void
    {
        $group = CollectionGroup::factory()->create();
        $this->createCollection($group, 'Alpha Collection');

        foreach (self::BLOCKED_ROLES as $role) {
            $this->actingAsRole($role);

            $response = $this->getJson('/api/admin/collections');

            $response->assertForbidden(
                "Role '{$role}' must be forbidden from listing collections (GET /api/admin/collections)."
            );
        }
    }

    public function test_allowed_roles_can_show_collection(): void
    {
        $group = CollectionGroup::factory()->create();
        $collection = $this->createCollection($group, 'Show Collection');

        foreach (self::ALLOWED_ROLES as $role) {
            $this->actingAsRole($role);

            $response = $this->getJson("/api/admin/collections/{$collection->id}");

            $response->assertOk(
                "Role '{$role}' must be permitted to show collection (GET /api/admin/collections/{$collection->id})."
            );
            $response->assertJsonPath('data.name.en', 'Show Collection');
        }
    }

    public function test_blocked_roles_cannot_show_collection(): void
    {
        $group = CollectionGroup::factory()->create();
        $collection = $this->createCollection($group, 'Show Collection');

        foreach (self::BLOCKED_ROLES as $role) {
            $this->actingAsRole($role);

            $response = $this->getJson("/api/admin/collections/{$collection->id}");

            $response->assertForbidden(
                "Role '{$role}' must be forbidden from showing collection (GET /api/admin/collections/{$collection->id})."
            );
        }
    }

    public function test_allowed_roles_can_create_collection(): void
    {
        $group = CollectionGroup::factory()->create();
        $counter = 1;

        foreach (self::ALLOWED_ROLES as $role) {
            $this->actingAsRole($role);

            $collectionName = "Collection Created By {$role} {$counter}";
            $counter++;

            $response = $this->postJson('/api/admin/collections', [
                'collection_group_id' => $group->id,
                'name' => $collectionName,
            ]);

            $response->assertCreated(
                "Role '{$role}' must be permitted to create collection (POST /api/admin/collections)."
            );
            $response->assertJsonPath('data.name.en', $collectionName);
        }
    }

    public function test_blocked_roles_cannot_create_collection(): void
    {
        $group = CollectionGroup::factory()->create();
        $counter = 1;

        foreach (self::BLOCKED_ROLES as $role) {
            $this->actingAsRole($role);

            $collectionName = "Unauthorized Collection {$role} {$counter}";
            $counter++;

            $response = $this->postJson('/api/admin/collections', [
                'collection_group_id' => $group->id,
                'name' => $collectionName,
            ]);

            $response->assertForbidden(
                "Role '{$role}' must be forbidden from creating collection (POST /api/admin/collections)."
            );
        }
    }

    public function test_allowed_roles_can_update_collection(): void
    {
        $group = CollectionGroup::factory()->create();
        $collection = $this->createCollection($group, 'Initial Name');
        $counter = 1;

        foreach (self::ALLOWED_ROLES as $role) {
            $this->actingAsRole($role);

            $newName = "Collection Updated By {$role} {$counter}";
            $counter++;

            $response = $this->putJson("/api/admin/collections/{$collection->id}", [
                'name' => $newName,
            ]);

            $response->assertOk(
                "Role '{$role}' must be permitted to update collection (PUT /api/admin/collections/{$collection->id})."
            );
            $response->assertJsonPath('data.name.en', $newName);
        }
    }

    public function test_blocked_roles_cannot_update_collection(): void
    {
        $group = CollectionGroup::factory()->create();
        $collection = $this->createCollection($group, 'Protected Collection');

        foreach (self::BLOCKED_ROLES as $role) {
            $this->actingAsRole($role);

            $response = $this->putJson("/api/admin/collections/{$collection->id}", [
                'name' => "Tampered By {$role}",
            ]);

            $response->assertForbidden(
                "Role '{$role}' must be forbidden from updating collection (PUT /api/admin/collections/{$collection->id})."
            );
        }
    }

    public function test_allowed_roles_can_delete_collection(): void
    {
        $group = CollectionGroup::factory()->create();
        $counter = 1;

        foreach (self::ALLOWED_ROLES as $role) {
            $this->actingAsRole($role);

            $collection = $this->createCollection($group, "To Delete {$role} {$counter}");
            $counter++;

            $response = $this->deleteJson("/api/admin/collections/{$collection->id}");

            $response->assertNoContent();

            $this->assertDatabaseMissing('lunar_collections', [
                'id' => $collection->id,
                'deleted_at' => null,
            ]);
        }
    }

    public function test_blocked_roles_cannot_delete_collection(): void
    {
        $group = CollectionGroup::factory()->create();
        $collection = $this->createCollection($group, 'Protected From Deletion');

        foreach (self::BLOCKED_ROLES as $role) {
            $this->actingAsRole($role);

            $response = $this->deleteJson("/api/admin/collections/{$collection->id}");

            $response->assertForbidden(
                "Role '{$role}' must be forbidden from deleting collection (DELETE /api/admin/collections/{$collection->id})."
            );

            $this->assertDatabaseHas('lunar_collections', [
                'id' => $collection->id,
            ]);
        }
    }

    public function test_allowed_roles_can_reorder_collection(): void
    {
        $group = CollectionGroup::factory()->create();
        $c1 = $this->createCollection($group, 'Reorder 1');
        $c2 = $this->createCollection($group, 'Reorder 2');

        foreach (self::ALLOWED_ROLES as $role) {
            $this->actingAsRole($role);

            $response = $this->postJson("/api/admin/collections/{$c1->id}/reorder", [
                'sibling_id' => $c2->id,
                'position' => 'after',
            ]);

            $response->assertOk(
                "Role '{$role}' must be permitted to reorder collection (POST /api/admin/collections/{$c1->id}/reorder)."
            );
        }
    }

    public function test_blocked_roles_cannot_reorder_collection(): void
    {
        $group = CollectionGroup::factory()->create();
        $c1 = $this->createCollection($group, 'Reorder Protected 1');
        $c2 = $this->createCollection($group, 'Reorder Protected 2');

        foreach (self::BLOCKED_ROLES as $role) {
            $this->actingAsRole($role);

            $response = $this->postJson("/api/admin/collections/{$c1->id}/reorder", [
                'sibling_id' => $c2->id,
                'position' => 'after',
            ]);

            $response->assertForbidden(
                "Role '{$role}' must be forbidden from reordering collection (POST /api/admin/collections/{$c1->id}/reorder)."
            );
        }
    }

    public function test_allowed_roles_can_move_collection(): void
    {
        $group1 = CollectionGroup::factory()->create();
        $group2 = CollectionGroup::factory()->create();
        $c1 = $this->createCollection($group1, 'Move 1');

        foreach (self::ALLOWED_ROLES as $role) {
            $this->actingAsRole($role);

            $response = $this->postJson("/api/admin/collections/{$c1->id}/move", [
                'collection_group_id' => $group2->id,
                'parent_id' => null,
            ]);

            $response->assertOk(
                "Role '{$role}' must be permitted to move collection (POST /api/admin/collections/{$c1->id}/move)."
            );
        }
    }

    public function test_blocked_roles_cannot_move_collection(): void
    {
        $group1 = CollectionGroup::factory()->create();
        $group2 = CollectionGroup::factory()->create();
        $c1 = $this->createCollection($group1, 'Move Protected 1');

        foreach (self::BLOCKED_ROLES as $role) {
            $this->actingAsRole($role);

            $response = $this->postJson("/api/admin/collections/{$c1->id}/move", [
                'collection_group_id' => $group2->id,
                'parent_id' => null,
            ]);

            $response->assertForbidden(
                "Role '{$role}' must be forbidden from moving collection (POST /api/admin/collections/{$c1->id}/move)."
            );
        }
    }

    public function test_allowed_roles_can_get_and_sync_collection_products(): void
    {
        $group = CollectionGroup::factory()->create();
        $collection = $this->createCollection($group, 'Collection Products');

        foreach (self::ALLOWED_ROLES as $role) {
            $this->actingAsRole($role);

            $getResponse = $this->getJson("/api/admin/collections/{$collection->id}/products");
            $getResponse->assertOk(
                "Role '{$role}' must be permitted to view collection products (GET /api/admin/collections/{$collection->id}/products)."
            );

            $product = Product::factory()->create();

            $syncResponse = $this->putJson("/api/admin/collections/{$collection->id}/products", [
                'product_ids' => [$product->id],
            ]);
            $syncResponse->assertOk(
                "Role '{$role}' must be permitted to sync collection products (PUT /api/admin/collections/{$collection->id}/products)."
            );
        }
    }

    public function test_blocked_roles_cannot_get_or_sync_collection_products(): void
    {
        $group = CollectionGroup::factory()->create();
        $collection = $this->createCollection($group, 'Collection Products Protected');

        foreach (self::BLOCKED_ROLES as $role) {
            $this->actingAsRole($role);

            $getResponse = $this->getJson("/api/admin/collections/{$collection->id}/products");
            $getResponse->assertForbidden(
                "Role '{$role}' must be forbidden from viewing collection products (GET /api/admin/collections/{$collection->id}/products)."
            );

            $syncResponse = $this->putJson("/api/admin/collections/{$collection->id}/products", [
                'product_ids' => [],
            ]);
            $syncResponse->assertForbidden(
                "Role '{$role}' must be forbidden from syncing collection products (PUT /api/admin/collections/{$collection->id}/products)."
            );
        }
    }

    public function test_migration_seeds_and_assigns_collection_permissions_to_existing_product_manager(): void
    {
        $migration = require database_path('migrations/2026_09_20_000002_seed_collections_domain_permissions.php');
        $migration->up();

        $pm = Role::query()->where('name', 'Product Manager')->where('guard_name', 'web')->first();
        $this->assertNotNull($pm);

        foreach (AdminAbilityRegistry::COLLECTIONS as $permission) {
            $this->assertTrue(
                $pm->hasPermissionTo($permission),
                "Product Manager must have permission '{$permission}' after migration."
            );
        }
    }

    public function test_unauthenticated_request_is_unauthorized_for_all_endpoints(): void
    {
        $group = CollectionGroup::factory()->create();
        $collection = $this->createCollection($group, 'Guest Collection');

        $this->getJson('/api/admin/collections')->assertUnauthorized();
        $this->postJson('/api/admin/collections', [
            'collection_group_id' => $group->id,
            'name' => 'Guest New',
        ])->assertUnauthorized();
        $this->getJson("/api/admin/collections/{$collection->id}")->assertUnauthorized();
        $this->putJson("/api/admin/collections/{$collection->id}", [
            'name' => 'Guest Edit',
        ])->assertUnauthorized();
        $this->deleteJson("/api/admin/collections/{$collection->id}")->assertUnauthorized();
        $this->postJson("/api/admin/collections/{$collection->id}/reorder", [
            'sibling_id' => 999,
            'position' => 'after',
        ])->assertUnauthorized();
        $this->postJson("/api/admin/collections/{$collection->id}/move", [
            'collection_group_id' => $group->id,
        ])->assertUnauthorized();
        $this->getJson("/api/admin/collections/{$collection->id}/products")->assertUnauthorized();
        $this->putJson("/api/admin/collections/{$collection->id}/products", [
            'product_ids' => [],
        ])->assertUnauthorized();
    }

    private function createCollection(CollectionGroup $group, string $name): Collection
    {
        $collection = new Collection([
            'collection_group_id' => $group->id,
            'attribute_data' => [
                'name' => new TranslatedText([
                    'en' => $name,
                    'vi' => $name,
                ]),
            ],
        ]);
        $collection->saveAsRoot();

        return $collection;
    }

    private function actingAsRole(string $role): User
    {
        $user = User::factory()->create();
        $user->assignRole($role);
        Sanctum::actingAs($user);

        return $user;
    }
}
