<?php

namespace Tests\Feature\Api\Admin;

use App\Models\BlogCategory;
use App\Models\CuratorMedia;
use App\Models\Post;
use App\Models\SiteMedia;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Lunar\FieldTypes\Text;
use Lunar\Models\Attribute;
use Lunar\Models\AttributeGroup;
use Lunar\Models\Channel;
use Lunar\Models\Currency;
use Lunar\Models\Language;
use Lunar\Models\Order;
use Lunar\Models\Product;
use Lunar\Models\ProductType;
use Lunar\Models\TaxClass;
use Spatie\Activitylog\Models\Activity;
use Spatie\MediaLibrary\MediaCollections\Models\Media;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class ActivityLogTest extends TestCase
{
    use RefreshDatabase;

    protected User $admin;

    protected Currency $currency;

    protected TaxClass $taxClass;

    protected ProductType $productType;

    protected Channel $channel;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(RoleSeeder::class);

        $this->admin = User::factory()->create();
        $this->admin->assignRole('admin');

        Storage::fake('public');

        Language::firstOrCreate(
            ['code' => 'en'],
            ['name' => 'English', 'default' => true]
        );

        $this->currency = Currency::firstOrCreate(
            ['code' => 'USD'],
            [
                'name' => 'US Dollar',
                'decimal_places' => 2,
                'default' => true,
                'enabled' => true,
                'exchange_rate' => 1,
            ]
        );

        $this->taxClass = TaxClass::firstOrCreate(
            ['name' => 'Default Tax'],
            ['default' => true]
        );

        $this->channel = Channel::firstOrCreate(
            ['handle' => 'default'],
            [
                'name' => 'Default Channel',
                'default' => true,
                'url' => 'http://localhost',
            ]
        );
        if (! $this->channel->default) {
            $this->channel->forceFill(['default' => true])->save();
        }

        $this->productType = ProductType::firstOrCreate(['name' => 'Standard Product']);

        $productGroup = AttributeGroup::firstOrCreate(
            ['handle' => 'product_details', 'attributable_type' => Product::morphName()],
            ['name' => ['en' => 'Product details'], 'position' => 1]
        );

        $nameAttribute = Attribute::firstOrCreate(
            ['handle' => 'name', 'attribute_type' => Product::morphName()],
            [
                'attribute_group_id' => $productGroup->id,
                'position' => 1,
                'name' => ['en' => 'Name'],
                'type' => Text::class,
                'required' => true,
                'searchable' => true,
                'configuration' => [],
                'system' => true,
            ]
        );

        $this->productType->mappedAttributes()->attach($nameAttribute->id);
    }

    public function test_role_permission_update_creates_activity_log(): void
    {
        Sanctum::actingAs($this->admin);

        $role = Role::findByName('Order Manager', 'web');

        $response = $this->putJson("/api/admin/system/roles/{$role->id}", [
            'permissions' => ['view_any_order', 'update_order'],
        ]);

        $response->assertOk();

        $activity = Activity::where('subject_type', Role::class)
            ->where('subject_id', $role->id)
            ->latest('id')
            ->first();

        $this->assertNotNull($activity);
        $this->assertEquals($this->admin->id, $activity->causer_id);
        $this->assertEquals('permissions_updated', $activity->description);
        $this->assertArrayHasKey('before', $activity->properties);
        $this->assertArrayHasKey('after', $activity->properties);
        $this->assertContains('view_any_order', $activity->properties['after']['permissions']);
        $this->assertContains('update_order', $activity->properties['after']['permissions']);
    }

    public function test_user_store_update_and_destroy_create_activity_logs(): void
    {
        Sanctum::actingAs($this->admin);

        // 1. Store
        $createResponse = $this->postJson('/api/admin/system/users', [
            'name' => 'Test Staff',
            'email' => 'teststaff@petposture.com',
            'password' => 'Password123!',
            'roles' => ['staff'],
            'is_active' => true,
        ]);

        $createResponse->assertCreated();
        $userId = $createResponse->json('data.id');

        $createActivity = Activity::where('subject_type', User::class)
            ->where('subject_id', $userId)
            ->where('description', 'created')
            ->first();

        $this->assertNotNull($createActivity);
        $this->assertEquals($this->admin->id, $createActivity->causer_id);
        $this->assertEquals('Test Staff', $createActivity->properties['after']['name']);
        $this->assertEquals('teststaff@petposture.com', $createActivity->properties['after']['email']);
        $this->assertContains('staff', $createActivity->properties['after']['roles']);

        // 2. Update
        $updateResponse = $this->putJson("/api/admin/system/users/{$userId}", [
            'name' => 'Updated Staff Name',
            'email' => 'teststaff@petposture.com',
            'roles' => ['staff'],
        ]);

        $updateResponse->assertOk();

        $updateActivity = Activity::where('subject_type', User::class)
            ->where('subject_id', $userId)
            ->where('description', 'updated')
            ->first();

        $this->assertNotNull($updateActivity);
        $this->assertEquals('Test Staff', $updateActivity->properties['before']['name']);
        $this->assertEquals('Updated Staff Name', $updateActivity->properties['after']['name']);

        // 3. Destroy
        $deleteResponse = $this->deleteJson("/api/admin/system/users/{$userId}");
        $deleteResponse->assertNoContent();

        $deleteActivity = Activity::where('subject_type', User::class)
            ->where('subject_id', $userId)
            ->where('description', 'deleted')
            ->first();

        $this->assertNotNull($deleteActivity);
        $this->assertEquals('Updated Staff Name', $deleteActivity->properties['before']['name']);
    }

    public function test_user_password_change_is_never_logged_in_properties(): void
    {
        Sanctum::actingAs($this->admin);

        $plainPassword1 = 'SuperSecretPlaintext123!';
        $createResponse = $this->postJson('/api/admin/system/users', [
            'name' => 'Secret User',
            'email' => 'secret@petposture.com',
            'password' => $plainPassword1,
            'roles' => ['staff'],
            'is_active' => true,
        ]);
        $createResponse->assertCreated();
        $userId = $createResponse->json('data.id');

        $plainPassword2 = 'AnotherSecretPassword456!';
        $updateResponse = $this->putJson("/api/admin/system/users/{$userId}", [
            'name' => 'Secret User',
            'email' => 'secret@petposture.com',
            'password' => $plainPassword2,
            'roles' => ['staff'],
        ]);
        $updateResponse->assertOk();

        $activities = Activity::where('subject_type', User::class)
            ->where('subject_id', $userId)
            ->get();

        $this->assertNotEmpty($activities);

        foreach ($activities as $act) {
            $json = json_encode($act->properties);
            $this->assertStringNotContainsString($plainPassword1, $json);
            $this->assertStringNotContainsString($plainPassword2, $json);
            $this->assertStringNotContainsString('$2y$', $json);
            $this->assertArrayNotHasKey('password', $act->properties['before'] ?? []);
            $this->assertArrayNotHasKey('password', $act->properties['after'] ?? []);
        }
    }

    public function test_media_deletion_creates_activity_log_with_context(): void
    {
        Sanctum::actingAs($this->admin);

        // 1. Curator media deletion
        $curatorMedia = CuratorMedia::create([
            'disk' => 'public',
            'directory' => 'media',
            'visibility' => 'public',
            'name' => 'dog-bed.jpg',
            'path' => 'media/dog-bed.jpg',
            'width' => 800,
            'height' => 600,
            'size' => 1024,
            'type' => 'image',
            'ext' => 'jpg',
            'folder' => CuratorMedia::FOLDER_GENERAL,
        ]);

        $delCurator = $this->deleteJson("/api/admin/system/media/curator/{$curatorMedia->id}");
        $delCurator->assertNoContent();

        $curatorActivity = Activity::where('subject_type', CuratorMedia::class)
            ->where('subject_id', $curatorMedia->id)
            ->latest('id')
            ->first();

        $this->assertNotNull($curatorActivity);
        $this->assertEquals('deleted', $curatorActivity->description);
        $this->assertEquals('curator', $curatorActivity->properties['before']['source']);
        $this->assertEquals('dog-bed.jpg', $curatorActivity->properties['before']['name']);

        // 2. Spatie media deletion
        $siteMedia = SiteMedia::create(['key' => 'hero_banner', 'name' => 'Hero Banner']);
        $spatieMedia = Media::create([
            'model_type' => SiteMedia::class,
            'model_id' => $siteMedia->id,
            'uuid' => fake()->uuid(),
            'collection_name' => 'banner',
            'name' => 'spatie-banner',
            'file_name' => 'spatie-banner.jpg',
            'mime_type' => 'image/jpeg',
            'disk' => 'public',
            'conversions_disk' => 'public',
            'size' => 2048,
            'manipulations' => [],
            'custom_properties' => [],
            'generated_conversions' => [],
            'responsive_images' => [],
            'order_column' => 1,
        ]);

        $delSpatie = $this->deleteJson("/api/admin/system/media/spatie/{$spatieMedia->id}");
        $delSpatie->assertNoContent();

        $spatieActivity = Activity::where('subject_type', Media::class)
            ->where('subject_id', $spatieMedia->id)
            ->latest('id')
            ->first();

        $this->assertNotNull($spatieActivity);
        $this->assertEquals('deleted', $spatieActivity->description);
        $this->assertEquals('spatie', $spatieActivity->properties['before']['source']);
        $this->assertEquals('spatie-banner', $spatieActivity->properties['before']['name']);
        $this->assertEquals('SiteMedia', $spatieActivity->properties['before']['attached_to']);
    }

    public function test_product_store_update_and_destroy_create_activity_logs(): void
    {
        Sanctum::actingAs($this->admin);

        // 1. Store
        $storeResponse = $this->postJson('/api/admin/products', [
            'name' => 'Super Orthopedic Bed',
            'sku' => 'ORTHO-BED-001',
            'base_price' => '129.99',
            'product_type_id' => $this->productType->id,
        ]);

        $storeResponse->assertCreated();
        $productId = $storeResponse->json('data.id');

        $productMorphClass = (new Product())->getMorphClass();

        $createActivity = Activity::where('subject_type', $productMorphClass)
            ->where('subject_id', $productId)
            ->where('description', 'created')
            ->where('log_name', 'default')
            ->first();

        $this->assertNotNull($createActivity);
        $this->assertEquals('Super Orthopedic Bed', $createActivity->properties['after']['name']);
        $this->assertEquals('ORTHO-BED-001', $createActivity->properties['after']['sku']);
        $this->assertEquals('129.99', $createActivity->properties['after']['base_price']);
        $this->assertEquals('draft', $createActivity->properties['after']['status']);

        // 2. Update (whitelisted: status, slug, brand_id - no name)
        $updateResponse = $this->putJson("/api/admin/products/{$productId}", [
            'status' => 'published',
            'slug' => 'super-ortho-bed',
            'attributes' => [
                'name' => 'Ignored Name In Log',
            ],
        ]);

        $updateResponse->assertOk();

        $updateActivity = Activity::where('subject_type', $productMorphClass)
            ->where('subject_id', $productId)
            ->where('description', 'updated')
            ->where('log_name', 'default')
            ->first();

        $this->assertNotNull($updateActivity);
        $this->assertEquals('draft', $updateActivity->properties['before']['status']);
        $this->assertEquals('published', $updateActivity->properties['after']['status']);
        $this->assertEquals('super-ortho-bed', $updateActivity->properties['after']['slug']);
        // Verify 'name' is NOT logged in properties
        $this->assertArrayNotHasKey('name', $updateActivity->properties['before'] ?? []);
        $this->assertArrayNotHasKey('name', $updateActivity->properties['after'] ?? []);

        // 3. Destroy (whitelisted: status, slug)
        $deleteResponse = $this->deleteJson("/api/admin/products/{$productId}");
        $deleteResponse->assertNoContent();

        $deleteActivity = Activity::where('subject_type', $productMorphClass)
            ->where('subject_id', $productId)
            ->where('description', 'deleted')
            ->where('log_name', 'default')
            ->first();

        $this->assertNotNull($deleteActivity);
        $this->assertEquals('published', $deleteActivity->properties['before']['status']);
        $this->assertEquals('super-ortho-bed', $deleteActivity->properties['before']['slug']);
        $this->assertArrayNotHasKey('name', $deleteActivity->properties['before'] ?? []);
    }

    public function test_order_update_refund_and_return_create_activity_logs_without_payment_data(): void
    {
        Sanctum::actingAs($this->admin);

        $orderMorphClass = (new Order())->getMorphClass();

        // 1. Order status update
        $order = Order::factory()->create([
            'status' => 'awaiting-payment',
            'user_id' => $this->admin->id,
            'total' => 10000,
        ]);

        $updateResponse = $this->patchJson("/api/orders/{$order->id}", [
            'status' => 'cancelled',
        ]);
        $updateResponse->assertOk();

        $updateActivity = Activity::where('subject_type', $orderMorphClass)
            ->where('subject_id', $order->id)
            ->where('description', 'updated')
            ->where('log_name', 'default')
            ->first();

        $this->assertNotNull($updateActivity);
        $this->assertEquals('awaiting-payment', $updateActivity->properties['before']['status']);
        $this->assertEquals('cancelled', $updateActivity->properties['after']['status']);

        // 2. Order refund (human-readable decimal amount)
        $paidOrder = Order::factory()->create([
            'status' => 'processing',
            'user_id' => $this->admin->id,
            'total' => 10000,
            'meta' => [
                'payment_intent_id' => 'pi_test_refund_123',
                'payment_status' => 'paid',
            ],
        ]);

        $refundResponse = $this->postJson("/api/admin/orders/{$paidOrder->id}/refund", [
            'amount' => 25.00,
            'reason' => 'customer_request',
        ]);
        $refundResponse->assertOk();

        $refundActivity = Activity::where('subject_type', $orderMorphClass)
            ->where('subject_id', $paidOrder->id)
            ->where('description', 'refunded')
            ->where('log_name', 'default')
            ->first();

        $this->assertNotNull($refundActivity);
        $this->assertEquals(25.00, (float) $refundActivity->properties['amount']);
        $this->assertEquals('customer_request', $refundActivity->properties['reason']);

        // 3. Order return
        $deliveredOrder = Order::factory()->create([
            'status' => 'delivered',
            'user_id' => $this->admin->id,
            'total' => 5000,
        ]);

        $returnResponse = $this->postJson("/api/admin/orders/{$deliveredOrder->id}/return");
        $returnResponse->assertOk();

        $returnActivity = Activity::where('subject_type', $orderMorphClass)
            ->where('subject_id', $deliveredOrder->id)
            ->where('description', 'returned')
            ->where('log_name', 'default')
            ->first();

        $this->assertNotNull($returnActivity);
        $this->assertEquals('returned', $returnActivity->properties['after']['fulfillment_status']);
    }

    public function test_post_store_update_and_destroy_create_activity_logs(): void
    {
        Sanctum::actingAs($this->admin);

        $category = BlogCategory::create([
            'name' => 'Ergonomics',
            'slug' => 'ergonomics',
        ]);

        // 1. Store
        $storeResponse = $this->postJson('/api/admin/posts', [
            'title' => 'Dog Ergonomics Guide',
            'content' => 'Comprehensive guide to dog ergonomics.',
            'blog_category_id' => $category->id,
            'status' => 'draft',
        ]);

        $storeResponse->assertCreated();
        $postId = $storeResponse->json('data.id');

        $createActivity = Activity::where('subject_type', Post::class)
            ->where('subject_id', $postId)
            ->where('description', 'created')
            ->first();

        $this->assertNotNull($createActivity);
        $this->assertEquals('Dog Ergonomics Guide', $createActivity->properties['after']['title']);
        $this->assertEquals('draft', $createActivity->properties['after']['status']);

        // 2. Update
        $updateResponse = $this->putJson("/api/admin/posts/{$postId}", [
            'title' => 'Updated Ergonomics Guide',
            'content' => 'Comprehensive guide to dog ergonomics updated.',
            'blog_category_id' => $category->id,
            'status' => 'draft',
        ]);
        $updateResponse->assertOk();

        $updateActivity = Activity::where('subject_type', Post::class)
            ->where('subject_id', $postId)
            ->where('description', 'updated')
            ->first();

        $this->assertNotNull($updateActivity);
        $this->assertEquals('Dog Ergonomics Guide', $updateActivity->properties['before']['title']);
        $this->assertEquals('Updated Ergonomics Guide', $updateActivity->properties['after']['title']);

        // 3. Destroy
        $deleteResponse = $this->deleteJson("/api/admin/posts/{$postId}");
        $deleteResponse->assertNoContent();

        $deleteActivity = Activity::where('subject_type', Post::class)
            ->where('subject_id', $postId)
            ->where('description', 'deleted')
            ->first();

        $this->assertNotNull($deleteActivity);
        $this->assertEquals('Updated Ergonomics Guide', $deleteActivity->properties['before']['title']);
    }

    public function test_activity_logs_index_returns_paginated_results(): void
    {
        Sanctum::actingAs($this->admin);

        for ($i = 1; $i <= 25; $i++) {
            activity()
                ->causedBy($this->admin)
                ->withProperties(['index' => $i])
                ->log("test_event_{$i}");
        }

        $response = $this->getJson('/api/admin/system/activity-logs?per_page=10&page=1');

        $response->assertOk();
        $response->assertJsonStructure([
            'data' => [
                '*' => [
                    'id',
                    'actor' => ['id', 'name', 'email'],
                    'event',
                    'subject_type',
                    'subject_id',
                    'description',
                    'properties',
                    'created_at',
                ],
            ],
            'meta' => [
                'current_page',
                'last_page',
                'per_page',
                'total',
            ],
        ]);

        $this->assertCount(10, $response->json('data'));
        $this->assertEquals(1, $response->json('meta.current_page'));
        $this->assertEquals(10, $response->json('meta.per_page'));
        $this->assertGreaterThanOrEqual(25, $response->json('meta.total'));
    }

    public function test_activity_logs_index_filters_by_causer_id(): void
    {
        Sanctum::actingAs($this->admin);

        $otherAdmin = User::factory()->create();
        $otherAdmin->assignRole('admin');

        activity()->causedBy($this->admin)->log('action_by_admin');
        activity()->causedBy($otherAdmin)->log('action_by_other');

        $response = $this->getJson("/api/admin/system/activity-logs?causer_id={$this->admin->id}");

        $response->assertOk();
        $items = $response->json('data');
        $this->assertNotEmpty($items);

        foreach ($items as $item) {
            $this->assertEquals($this->admin->id, $item['actor']['id']);
        }
    }

    public function test_activity_logs_index_filters_by_subject_type(): void
    {
        Sanctum::actingAs($this->admin);

        $product = Product::create([
            'status' => 'draft',
            'product_type_id' => $this->productType->id,
            'attribute_data' => [],
        ]);

        $category = BlogCategory::create([
            'name' => 'Filter Cat',
            'slug' => 'filter-cat',
        ]);

        $post = Post::create([
            'title' => 'Filter Test Post',
            'slug' => 'filter-test-post',
            'content' => 'Content',
            'blog_category_id' => $category->id,
            'status' => 'draft',
        ]);

        activity()->performedOn($product)->log('product_action');
        activity()->performedOn($post)->log('post_action');

        $response = $this->getJson('/api/admin/system/activity-logs?subject_type=Product');

        $response->assertOk();
        $items = $response->json('data');
        $this->assertNotEmpty($items);

        foreach ($items as $item) {
            $this->assertEquals('Product', $item['subject_type']);
        }
    }

    public function test_activity_logs_index_filters_by_date_range(): void
    {
        Sanctum::actingAs($this->admin);

        $oldActivity = activity()->log('old_event');
        $oldActivity->created_at = now()->subDays(10);
        $oldActivity->save();

        $midActivity = activity()->log('mid_event');
        $midActivity->created_at = now()->subDays(3);
        $midActivity->save();

        $newActivity = activity()->log('new_event');
        $newActivity->created_at = now();
        $newActivity->save();

        $dateFrom = now()->subDays(5)->toDateString();
        $dateTo = now()->subDays(1)->toDateString();

        $response = $this->getJson("/api/admin/system/activity-logs?date_from={$dateFrom}&date_to={$dateTo}");

        $response->assertOk();
        $items = $response->json('data');
        $descriptions = collect($items)->pluck('description')->all();

        $this->assertContains('mid_event', $descriptions);
        $this->assertNotContains('old_event', $descriptions);
        $this->assertNotContains('new_event', $descriptions);
    }

    public function test_non_core_admin_cannot_access_activity_logs_endpoint_returns_403(): void
    {
        foreach (['Product Manager', 'Order Manager', 'Support', 'customer'] as $roleName) {
            $user = User::factory()->create();
            $user->assignRole($roleName);

            Sanctum::actingAs($user);

            $this->getJson('/api/admin/system/activity-logs')->assertForbidden();
        }
    }

    public function test_unauthenticated_request_returns_401(): void
    {
        $this->getJson('/api/admin/system/activity-logs')->assertUnauthorized();
    }

    public function test_failed_order_return_does_not_create_activity_log(): void
    {
        Sanctum::actingAs($this->admin);

        $orderMorphClass = (new Order())->getMorphClass();

        // Orders with status 'awaiting-payment' fail returnOrder() validation
        $order = Order::factory()->create([
            'status' => 'awaiting-payment',
            'user_id' => $this->admin->id,
            'total' => 5000,
        ]);

        $response = $this->postJson("/api/admin/orders/{$order->id}/return");
        $response->assertStatus(422);

        $activity = Activity::where('subject_type', $orderMorphClass)
            ->where('subject_id', $order->id)
            ->where('description', 'returned')
            ->where('log_name', 'default')
            ->first();

        $this->assertNull($activity);
    }

    public function test_failed_product_destroy_does_not_create_activity_log(): void
    {
        Sanctum::actingAs($this->admin);

        $productMorphClass = (new Product())->getMorphClass();

        $product = Product::create([
            'product_type_id' => $this->productType->id,
            'status' => 'draft',
            'attribute_data' => [],
        ]);

        Product::deleting(function () {
            throw new \RuntimeException('Simulated product deletion failure');
        });

        try {
            $this->deleteJson("/api/admin/products/{$product->id}");
        } catch (\RuntimeException $e) {
            // Simulated failure caught
        }

        Product::flushEventListeners();

        $activity = Activity::where('subject_type', $productMorphClass)
            ->where('subject_id', $product->id)
            ->where('description', 'deleted')
            ->where('log_name', 'default')
            ->first();

        $this->assertNull($activity);
        $this->assertDatabaseHas('lunar_products', ['id' => $product->id]);
    }

    public function test_failed_post_destroy_does_not_create_activity_log(): void
    {
        Sanctum::actingAs($this->admin);

        $category = BlogCategory::create([
            'name' => 'Failsafe Category',
            'slug' => 'failsafe-category',
        ]);

        $post = Post::create([
            'title' => 'Undeletable Post',
            'slug' => 'undeletable-post',
            'content' => 'Content',
            'status' => 'draft',
            'blog_category_id' => $category->id,
            'author_id' => $this->admin->id,
        ]);

        Post::deleting(function () {
            throw new \RuntimeException('Simulated post deletion failure');
        });

        try {
            $this->deleteJson("/api/admin/posts/{$post->id}");
        } catch (\RuntimeException $e) {
            // Simulated failure caught
        }

        Post::flushEventListeners();

        $activity = Activity::where('subject_type', Post::class)
            ->where('subject_id', $post->id)
            ->where('description', 'deleted')
            ->where('log_name', 'default')
            ->first();

        $this->assertNull($activity);
        $this->assertDatabaseHas('posts', ['id' => $post->id]);
    }

    public function test_failed_system_user_destroy_does_not_create_activity_log(): void
    {
        Sanctum::actingAs($this->admin);

        // Deleting own account fails with 409 Conflict guard
        $response = $this->deleteJson("/api/admin/system/users/{$this->admin->id}");
        $response->assertStatus(409);

        $activity = Activity::where('subject_type', User::class)
            ->where('subject_id', $this->admin->id)
            ->where('description', 'deleted')
            ->where('log_name', 'default')
            ->first();

        $this->assertNull($activity);
        $this->assertDatabaseHas('users', ['id' => $this->admin->id]);
    }
}
