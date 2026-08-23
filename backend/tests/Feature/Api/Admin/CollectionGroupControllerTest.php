<?php

namespace Tests\Feature\Api\Admin;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Lunar\Models\Collection;
use Lunar\Models\CollectionGroup;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class CollectionGroupControllerTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        Role::firstOrCreate(['name' => 'admin', 'guard_name' => 'web']);
        Role::firstOrCreate(['name' => 'customer', 'guard_name' => 'web']);
    }

    public function test_unauthenticated_request_is_rejected(): void
    {
        $this->getJson('/api/admin/collection-groups')->assertUnauthorized();
    }

    public function test_customer_cannot_access_collection_groups(): void
    {
        $customer = User::factory()->create();
        $customer->assignRole('customer');
        Sanctum::actingAs($customer);

        $this->getJson('/api/admin/collection-groups')->assertForbidden();
    }

    public function test_index_is_sorted_and_counts_only_active_collections(): void
    {
        $this->actingAsAdmin();
        $zulu = CollectionGroup::query()->create(['name' => 'Zulu', 'handle' => 'zulu']);
        $alpha = CollectionGroup::query()->create(['name' => 'Alpha', 'handle' => 'alpha']);
        Collection::factory()->count(2)->create(['collection_group_id' => $alpha->id]);
        $deletedCollection = Collection::factory()->create(['collection_group_id' => $alpha->id]);
        $deletedCollection->update(['deleted_at' => now()]);

        $response = $this->getJson('/api/admin/collection-groups')->assertOk();

        $response->assertJsonPath('data.0.name', 'Alpha')
            ->assertJsonPath('data.0.handle', 'alpha')
            ->assertJsonPath('data.0.collections_count', 2)
            ->assertJsonPath('data.1.name', 'Zulu')
            ->assertJsonPath('data.1.handle', 'zulu')
            ->assertJsonPath('data.1.collections_count', 0);
        $this->assertCount(2, $response->json('data'));
        $this->assertDatabaseCount('lunar_collection_groups', 2);
        $this->assertSame(0, Collection::query()->where('collection_group_id', $zulu->id)->count());
    }

    public function test_create_and_show_use_flat_english_name_and_manual_handle(): void
    {
        $this->actingAsAdmin();

        $created = $this->postJson('/api/admin/collection-groups', [
            'name' => 'Dog Walking',
            'handle' => 'manual-dog-handle',
        ])->assertCreated()
            ->assertJsonPath('data.name', 'Dog Walking')
            ->assertJsonPath('data.handle', 'manual-dog-handle')
            ->assertJsonPath('data.collections_count', 0);

        $id = $created->json('data.id');

        $this->getJson("/api/admin/collection-groups/{$id}")
            ->assertOk()
            ->assertJsonPath('data.id', $id)
            ->assertJsonPath('data.name', 'Dog Walking')
            ->assertJsonPath('data.handle', 'manual-dog-handle')
            ->assertJsonPath('data.collections_count', 0);

        $this->assertDatabaseHas('lunar_collection_groups', [
            'id' => $id,
            'name' => 'Dog Walking',
            'handle' => 'manual-dog-handle',
        ]);
    }

    public function test_duplicate_name_and_handle_return_validation_errors(): void
    {
        $this->actingAsAdmin();
        CollectionGroup::query()->create(['name' => 'Existing', 'handle' => 'existing']);

        $this->postJson('/api/admin/collection-groups', [
            'name' => 'Existing',
            'handle' => 'new-handle',
        ])->assertUnprocessable()->assertJsonValidationErrors('name');

        $this->postJson('/api/admin/collection-groups', [
            'name' => 'New Name',
            'handle' => 'existing',
        ])->assertUnprocessable()->assertJsonValidationErrors('handle');
    }

    public function test_update_name_keeps_existing_handle_when_it_is_sent(): void
    {
        $this->actingAsAdmin();
        $group = CollectionGroup::query()->create(['name' => 'Old Name', 'handle' => 'stable-handle']);

        $this->putJson("/api/admin/collection-groups/{$group->id}", [
            'name' => 'New Name',
            'handle' => 'stable-handle',
        ])->assertOk()
            ->assertJsonPath('data.name', 'New Name')
            ->assertJsonPath('data.handle', 'stable-handle');

        $this->assertDatabaseHas('lunar_collection_groups', [
            'id' => $group->id,
            'name' => 'New Name',
            'handle' => 'stable-handle',
        ]);
    }

    public function test_explicit_handle_update_succeeds_and_collisions_are_rejected(): void
    {
        $this->actingAsAdmin();
        $group = CollectionGroup::query()->create(['name' => 'Editable', 'handle' => 'old-handle']);
        $other = CollectionGroup::query()->create(['name' => 'Other', 'handle' => 'other-handle']);

        $this->putJson("/api/admin/collection-groups/{$group->id}", [
            'name' => 'Editable',
            'handle' => 'new-handle',
        ])->assertOk()->assertJsonPath('data.handle', 'new-handle');

        $this->putJson("/api/admin/collection-groups/{$group->id}", [
            'name' => $other->name,
            'handle' => 'new-handle',
        ])->assertUnprocessable()->assertJsonValidationErrors('name');

        $this->putJson("/api/admin/collection-groups/{$group->id}", [
            'name' => 'Editable',
            'handle' => $other->handle,
        ])->assertUnprocessable()->assertJsonValidationErrors('handle');
    }

    public function test_delete_is_blocked_when_active_collection_uses_group(): void
    {
        $this->actingAsAdmin();
        $group = CollectionGroup::query()->create(['name' => 'Used Active', 'handle' => 'used-active']);
        Collection::factory()->create(['collection_group_id' => $group->id]);

        $this->deleteJson("/api/admin/collection-groups/{$group->id}")
            ->assertConflict()
            ->assertJsonPath('code', 'COLLECTION_GROUP_IN_USE')
            ->assertJsonPath('details.collection_group_id', $group->id)
            ->assertJsonPath('details.collections_count', 1);

        $this->assertDatabaseHas('lunar_collection_groups', ['id' => $group->id]);
    }

    public function test_delete_is_blocked_when_soft_deleted_collection_uses_group(): void
    {
        $this->actingAsAdmin();
        $group = CollectionGroup::query()->create(['name' => 'Used Deleted', 'handle' => 'used-deleted']);
        $collection = Collection::factory()->create(['collection_group_id' => $group->id]);
        $collection->update(['deleted_at' => now()]);

        $this->deleteJson("/api/admin/collection-groups/{$group->id}")
            ->assertConflict()
            ->assertJsonPath('code', 'COLLECTION_GROUP_IN_USE')
            ->assertJsonPath('details.collection_group_id', $group->id)
            ->assertJsonPath('details.collections_count', 1);

        $this->assertDatabaseHas('lunar_collection_groups', ['id' => $group->id]);
    }

    public function test_unused_collection_group_can_be_deleted(): void
    {
        $this->actingAsAdmin();
        $group = CollectionGroup::query()->create(['name' => 'Unused', 'handle' => 'unused']);

        $this->deleteJson("/api/admin/collection-groups/{$group->id}")->assertNoContent();

        $this->assertDatabaseMissing('lunar_collection_groups', ['id' => $group->id]);
    }

    private function actingAsAdmin(): User
    {
        $admin = User::factory()->create();
        $admin->assignRole('admin');
        Sanctum::actingAs($admin);

        return $admin;
    }
}
