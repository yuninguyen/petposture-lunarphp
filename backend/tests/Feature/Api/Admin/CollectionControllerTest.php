<?php

namespace Tests\Feature\Api\Admin;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Lunar\FieldTypes\Text;
use Lunar\FieldTypes\TranslatedText;
use Lunar\Models\Attribute;
use Lunar\Models\AttributeGroup;
use Lunar\Models\Collection;
use Lunar\Models\CollectionGroup;
use Lunar\Models\Product;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class CollectionControllerTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        Role::firstOrCreate(['name' => 'admin', 'guard_name' => 'web']);
        Role::firstOrCreate(['name' => 'customer', 'guard_name' => 'web']);
    }

    public function test_collection_routes_require_admin_authentication(): void
    {
        $this->getJson('/api/admin/collections')->assertUnauthorized();

        $customer = User::factory()->create();
        $customer->assignRole('customer');
        Sanctum::actingAs($customer);

        $this->getJson('/api/admin/collections')->assertForbidden();
    }

    public function test_bootstrap_migration_has_exact_idempotent_collection_contract(): void
    {
        $migration = require database_path('migrations/2026_08_24_000000_ensure_collection_name_attribute.php');
        $migration->up();
        $migration->up();

        $group = AttributeGroup::query()->where('handle', 'collection_details')->sole();
        $attribute = Attribute::query()
            ->where('attribute_type', Collection::morphName())
            ->where('handle', 'name')
            ->sole();

        $this->assertSame(Collection::morphName(), $group->attributable_type);
        $this->assertSame('Details', $group->name->get('en'));
        $this->assertSame($group->id, $attribute->attribute_group_id);
        $this->assertSame(TranslatedText::class, $attribute->type);
        $this->assertSame(1, (int) $attribute->required);
        $this->assertSame(1, (int) $attribute->system);
        $this->assertSame(0, (int) $attribute->filterable);
        $this->assertSame(1, (int) $attribute->searchable);
        $this->assertSame(1, AttributeGroup::query()->where('handle', 'collection_details')->count());
        $this->assertSame(1, Attribute::query()->where('attribute_type', 'collection')->where('handle', 'name')->count());
    }

    public function test_bootstrap_adopts_compatible_existing_name_attribute_without_overwriting_it(): void
    {
        $existing = Attribute::query()->where('attribute_type', 'collection')->where('handle', 'name')->firstOrFail();
        $existingGroup = $existing->attributeGroup;
        $existing->delete();
        $existingGroup->delete();

        $group = AttributeGroup::query()->create([
            'attributable_type' => 'collection',
            'name' => ['en' => 'Production Details'],
            'handle' => 'production_collection_fields',
            'position' => 7,
        ]);
        $attribute = Attribute::query()->create([
            'attribute_type' => 'collection',
            'attribute_group_id' => $group->id,
            'position' => 9,
            'name' => ['en' => 'Production Name'],
            'description' => ['en' => 'Keep me'],
            'handle' => 'name',
            'section' => 'main',
            'type' => TranslatedText::class,
            'required' => true,
            'default_value' => null,
            'configuration' => ['richtext' => false],
            'system' => true,
            'validation_rules' => null,
            'filterable' => false,
            'searchable' => true,
        ]);
        $attribute->refresh();
        $before = $attribute->getRawOriginal();
        ksort($before);

        $migration = require database_path('migrations/2026_08_24_000000_ensure_collection_name_attribute.php');
        $migration->up();

        $after = $attribute->fresh()->getRawOriginal();
        ksort($after);
        $this->assertSame($before, $after);
        $this->assertDatabaseMissing('lunar_attribute_groups', ['handle' => 'collection_details']);
    }

    public function test_bootstrap_fails_on_incompatible_collection_details_handle(): void
    {
        $existing = Attribute::query()->where('attribute_type', 'collection')->where('handle', 'name')->firstOrFail();
        $existingGroup = $existing->attributeGroup;
        $existing->delete();
        $existingGroup->delete();

        AttributeGroup::query()->create([
            'attributable_type' => 'product',
            'name' => ['en' => 'Wrong'],
            'handle' => 'collection_details',
            'position' => 99,
        ]);

        $this->expectException(\RuntimeException::class);
        $this->expectExceptionMessage('collection_details attribute group handle');

        $migration = require database_path('migrations/2026_08_24_000000_ensure_collection_name_attribute.php');
        $migration->up();
    }

    public function test_bootstrap_fails_on_wrong_collection_name_attribute_type(): void
    {
        $attribute = Attribute::query()->where('attribute_type', 'collection')->where('handle', 'name')->firstOrFail();
        $attribute->update(['type' => Text::class]);

        $this->expectException(\RuntimeException::class);
        $this->expectExceptionMessage('not a TranslatedText');

        $migration = require database_path('migrations/2026_08_24_000000_ensure_collection_name_attribute.php');
        $migration->up();
    }

    public function test_admin_can_list_and_sync_collection_products_in_position_order(): void
    {
        $this->actingAsAdmin();
        $group = CollectionGroup::factory()->create();
        $collection = $this->root($group, 'Dogs', 'Chó');
        $first = Product::factory()->create();
        $second = Product::factory()->create();
        $third = Product::factory()->create();
        $collection->products()->attach($first->id, ['position' => 4]);
        $collection->products()->attach($second->id, ['position' => 1]);

        $this->getJson('/api/admin/collections/'.$collection->id.'/products')
            ->assertOk()
            ->assertJsonPath('data.0.id', $second->id)
            ->assertJsonPath('data.0.position', 0)
            ->assertJsonPath('data.1.id', $first->id)
            ->assertJsonPath('data.1.position', 1);

        $this->putJson('/api/admin/collections/'.$collection->id.'/products', [
            'product_ids' => [$third->id, $first->id],
        ])->assertOk()
            ->assertJsonPath('data.0.id', $third->id)
            ->assertJsonPath('data.0.position', 0)
            ->assertJsonPath('data.1.id', $first->id)
            ->assertJsonPath('data.1.position', 1);

        $this->assertDatabaseHas('lunar_collection_product', [
            'collection_id' => $collection->id,
            'product_id' => $third->id,
            'position' => 0,
        ]);
        $this->assertDatabaseMissing('lunar_collection_product', [
            'collection_id' => $collection->id,
            'product_id' => $second->id,
        ]);
    }

    public function test_collection_product_sync_validates_distinct_existing_ids(): void
    {
        $this->actingAsAdmin();
        $group = CollectionGroup::factory()->create();
        $collection = $this->root($group, 'Dogs', 'Chó');

        $this->putJson('/api/admin/collections/'.$collection->id.'/products', [
            'product_ids' => [999999, 999999],
        ])->assertUnprocessable()
            ->assertJsonValidationErrors(['product_ids.0', 'product_ids.1']);
    }

    public function test_index_returns_groups_sorted_with_nested_active_bilingual_tree(): void
    {
        $this->actingAsAdmin();
        $zulu = CollectionGroup::query()->create(['name' => 'Zulu', 'handle' => 'zulu']);
        $alpha = CollectionGroup::query()->create(['name' => 'Alpha', 'handle' => 'alpha']);
        $root = $this->root($alpha, 'Dogs', 'Chó');
        $child = $this->child($root, 'Small Dogs', 'Chó nhỏ');
        $deleted = $this->child($root, 'Deleted', 'Đã xóa');
        $deleted->update(['deleted_at' => now()]);
        $this->root($zulu, 'Cats', 'Mèo');
        $legacy = new Collection([
            'collection_group_id' => $zulu->id,
            'attribute_data' => ['name' => new Text('Legacy scalar')],
        ]);
        $legacy->saveAsRoot();

        $response = $this->getJson('/api/admin/collections')->assertOk();

        $response->assertJsonPath('data.0.name', 'Alpha')
            ->assertJsonPath('data.0.collections.0.name.en', 'Dogs')
            ->assertJsonPath('data.0.collections.0.name.vi', 'Chó')
            ->assertJsonPath('data.0.collections.0.slug', 'dogs')
            ->assertJsonPath('data.0.collections.0.children_count', 1)
            ->assertJsonPath('data.0.collections.0.children.0.id', $child->id)
            ->assertJsonPath('data.0.collections.0.children.0.name.vi', 'Chó nhỏ')
            ->assertJsonPath('data.1.name', 'Zulu')
            ->assertJsonPath('data.1.collections.1.name.en', 'Legacy scalar')
            ->assertJsonPath('data.1.collections.1.name.vi', '');
    }

    public function test_admin_can_create_root_and_same_group_child_with_mirrored_names(): void
    {
        $this->actingAsAdmin();
        $group = CollectionGroup::factory()->create();

        $rootResponse = $this->postJson('/api/admin/collections', [
            'collection_group_id' => $group->id,
            'name' => 'Root',
        ])->assertCreated();
        $root = Collection::query()->findOrFail($rootResponse->json('data.id'));

        $this->assertTrue($root->isRoot());
        $this->assertSame('Root', $rootResponse->json('data.name.en'));
        $this->assertSame('Root', $rootResponse->json('data.name.vi'));

        $childResponse = $this->postJson('/api/admin/collections', [
            'collection_group_id' => $group->id,
            'parent_id' => $root->id,
            'name' => 'Child',
        ])->assertCreated();
        $child = Collection::query()->findOrFail($childResponse->json('data.id'));

        $this->assertTrue($child->isChildOf($root->fresh()));
        $this->assertSame($group->id, $child->collection_group_id);

        $this->getJson('/api/admin/collections/'.$root->id)
            ->assertOk()
            ->assertJsonPath('data.name.en', 'Root')
            ->assertJsonPath('data.name.vi', 'Root')
            ->assertJsonPath('data.children.0.id', $child->id)
            ->assertJsonPath('data.children.0.name.en', 'Child')
            ->assertJsonPath('data.children.0.name.vi', 'Child');
    }

    public function test_frontend_form_data_name_is_normalized_to_one_mirrored_value(): void
    {
        $this->actingAsAdmin();
        $group = CollectionGroup::factory()->create();

        $this->post('/api/admin/collections', [
            'collection_group_id' => $group->id,
            'name' => ['en' => 'Bowls', 'vi' => 'Bowls'],
        ])->assertCreated()
            ->assertJsonPath('data.name.en', 'Bowls')
            ->assertJsonPath('data.name.vi', 'Bowls');
    }

    public function test_child_creation_rejects_parent_from_another_group(): void
    {
        $this->actingAsAdmin();
        $source = CollectionGroup::factory()->create();
        $target = CollectionGroup::factory()->create();
        $parent = $this->root($source, 'Parent', 'Cha');

        $this->postJson('/api/admin/collections', [
            'collection_group_id' => $target->id,
            'parent_id' => $parent->id,
            'name' => 'Child',
        ])->assertUnprocessable()->assertJsonValidationErrors('parent_id');
    }

    public function test_update_mirrors_name_and_preserves_other_attributes(): void
    {
        $this->actingAsAdmin();
        $group = CollectionGroup::factory()->create();
        $collection = $this->root($group, 'Old', 'Cũ', [
            'description' => new Text('Keep this'),
        ]);

        $this->putJson('/api/admin/collections/'.$collection->id, [
            'name' => 'New',
        ])->assertOk()
            ->assertJsonPath('data.name.en', 'New')
            ->assertJsonPath('data.name.vi', 'New');

        $collection->refresh();
        $this->assertSame('Keep this', $collection->attribute_data->get('description')->getValue());
    }

    public function test_delete_hard_deletes_leaf_but_guards_active_or_deleted_children_and_products_including_trashed(): void
    {
        $this->actingAsAdmin();
        $group = CollectionGroup::factory()->create();

        $leaf = $this->root($group, 'Leaf', 'Lá');
        $this->deleteJson('/api/admin/collections/'.$leaf->id)->assertNoContent();
        $this->assertDatabaseMissing('lunar_collections', ['id' => $leaf->id]);

        $parent = $this->root($group, 'Parent', 'Cha');
        $child = $this->child($parent, 'Child', 'Con');
        $child->update(['deleted_at' => now()]);
        $this->deleteJson('/api/admin/collections/'.$parent->id)
            ->assertConflict()
            ->assertJsonPath('code', 'COLLECTION_IN_USE')
            ->assertJsonPath('details.children_count', 1);

        $productCollection = $this->root($group, 'Products', 'Sản phẩm');
        $product = Product::factory()->create();
        $productCollection->products()->attach($product->id, ['position' => 1]);
        $product->delete();
        $this->deleteJson('/api/admin/collections/'.$productCollection->id)
            ->assertConflict()
            ->assertJsonPath('details.products_count', 1);
    }

    public function test_reorder_requires_same_parent_and_moves_before_or_after(): void
    {
        $this->actingAsAdmin();
        $group = CollectionGroup::factory()->create();
        $a = $this->root($group, 'A', 'A');
        $b = $this->root($group, 'B', 'B');
        $c = $this->root($group, 'C', 'C');

        $this->postJson('/api/admin/collections/'.$c->id.'/reorder', [
            'sibling_id' => $a->id,
            'position' => 'before',
        ])->assertOk();

        $this->assertSame([$c->id, $a->id, $b->id], Collection::query()
            ->where('collection_group_id', $group->id)->defaultOrder()->pluck('id')->all());
        $this->assertFalse(Collection::scoped(['collection_group_id' => $group->id])->isBroken());

        $child = $this->child($a->fresh(), 'Child', 'Con');
        $this->postJson('/api/admin/collections/'.$b->id.'/reorder', [
            'sibling_id' => $child->id,
            'position' => 'after',
        ])->assertUnprocessable()->assertJsonValidationErrors('sibling_id');
    }

    public function test_same_group_move_make_root_and_cycle_validation_keep_tree_valid(): void
    {
        $this->actingAsAdmin();
        $group = CollectionGroup::factory()->create();
        $root = $this->root($group, 'Root', 'Gốc');
        $other = $this->root($group, 'Other', 'Khác');
        $child = $this->child($root, 'Child', 'Con');
        $grandchild = $this->child($child, 'Grandchild', 'Cháu');

        $this->postJson('/api/admin/collections/'.$child->id.'/move', [
            'collection_group_id' => $group->id,
            'parent_id' => $other->id,
        ])->assertOk();
        $this->assertSame($other->id, $child->fresh()->parent_id);

        $this->postJson('/api/admin/collections/'.$child->id.'/move', [
            'collection_group_id' => $group->id,
            'parent_id' => null,
        ])->assertOk();
        $this->assertTrue($child->fresh()->isRoot());

        $this->postJson('/api/admin/collections/'.$child->id.'/move', [
            'collection_group_id' => $group->id,
            'parent_id' => $grandchild->id,
        ])->assertUnprocessable()->assertJsonValidationErrors('parent_id');
        $this->assertFalse(Collection::scoped(['collection_group_id' => $group->id])->isBroken());
    }

    public function test_cross_group_move_preserves_subtree_ids_and_products_and_repairs_both_trees(): void
    {
        $this->actingAsAdmin();
        $source = CollectionGroup::factory()->create();
        $target = CollectionGroup::factory()->create();
        $sourceRoot = $this->root($source, 'Source', 'Nguồn');
        $moving = $this->child($sourceRoot, 'Moving', 'Di chuyển');
        $descendant = $this->child($moving, 'Descendant', 'Hậu duệ');
        $deletedDescendant = $this->child($moving, 'Deleted', 'Đã xóa');
        $deletedDescendant->update(['deleted_at' => now()]);
        $targetRoot = $this->root($target, 'Target', 'Đích');
        $product = Product::factory()->create();
        $moving->products()->attach($product->id, ['position' => 1]);

        $this->postJson('/api/admin/collections/'.$moving->id.'/move', [
            'collection_group_id' => $target->id,
            'parent_id' => $targetRoot->id,
        ])->assertOk();

        $this->assertSame($target->id, $moving->fresh()->collection_group_id);
        $this->assertSame($targetRoot->id, $moving->fresh()->parent_id);
        $this->assertSame($target->id, $descendant->fresh()->collection_group_id);
        $this->assertSame($target->id, Collection::query()->withoutGlobalScopes()->findOrFail($deletedDescendant->id)->collection_group_id);
        $this->assertDatabaseHas('lunar_collection_product', [
            'collection_id' => $moving->id,
            'product_id' => $product->id,
        ]);
        $this->assertFalse(Collection::scoped(['collection_group_id' => $source->id])->withoutGlobalScopes()->isBroken());
        $this->assertFalse(Collection::scoped(['collection_group_id' => $target->id])->withoutGlobalScopes()->isBroken());
    }

    private function actingAsAdmin(): User
    {
        $admin = User::factory()->create();
        $admin->assignRole('admin');
        Sanctum::actingAs($admin);

        return $admin;
    }

    private function root(CollectionGroup $group, string $en, string $vi, array $extraAttributes = []): Collection
    {
        $collection = new Collection([
            'collection_group_id' => $group->id,
            'attribute_data' => array_merge([
                'name' => new TranslatedText(['en' => $en, 'vi' => $vi]),
            ], $extraAttributes),
        ]);
        $collection->saveAsRoot();

        return $collection;
    }

    private function child(Collection $parent, string $en, string $vi): Collection
    {
        $collection = new Collection([
            'collection_group_id' => $parent->collection_group_id,
            'attribute_data' => [
                'name' => new TranslatedText(['en' => $en, 'vi' => $vi]),
            ],
        ]);
        $collection->appendToNode($parent)->save();

        return $collection;
    }
}
