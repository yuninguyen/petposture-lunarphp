<?php

namespace Tests\Feature\Api\Admin;

use App\Enums\ErrorCode;
use App\Models\Breed;
use App\Models\CuratorMedia;
use App\Models\Post;
use App\Models\SiteMedia;
use App\Models\Solution;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Lunar\FieldTypes\Text;
use Lunar\Models\Product as LunarProduct;
use Lunar\Models\ProductType;
use Spatie\MediaLibrary\MediaCollections\Models\Media;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class MediaLibraryControllerTest extends TestCase
{
    use RefreshDatabase;

    protected User $admin;

    protected function setUp(): void
    {
        parent::setUp();

        Role::firstOrCreate(['name' => 'super_admin', 'guard_name' => 'web']);
        Role::firstOrCreate(['name' => 'admin', 'guard_name' => 'web']);
        Role::firstOrCreate(['name' => 'customer', 'guard_name' => 'web']);

        Storage::fake('public');

        $this->admin = User::factory()->create();
        $this->admin->assignRole('admin');
    }

    public function test_unauthenticated_requests_are_rejected(): void
    {
        $this->getJson('/api/admin/system/media')->assertUnauthorized();
        $this->deleteJson('/api/admin/system/media/curator/1')->assertUnauthorized();
        $this->deleteJson('/api/admin/system/media/spatie/1')->assertUnauthorized();
    }

    public function test_customer_cannot_access_system_media(): void
    {
        $customer = User::factory()->create();
        $customer->assignRole('customer');
        Sanctum::actingAs($customer);

        $this->getJson('/api/admin/system/media')->assertForbidden();
        $this->deleteJson('/api/admin/system/media/curator/1')->assertForbidden();
    }

    public function test_index_returns_both_sources_when_source_is_all_and_sorts_descending(): void
    {
        Sanctum::actingAs($this->admin);

        $curator1 = $this->createCuratorMedia([
            'name' => 'curator-old.jpg',
            'created_at' => now()->subHours(4),
        ]);
        $curator2 = $this->createCuratorMedia([
            'name' => 'curator-new.jpg',
            'created_at' => now()->subHour(),
        ]);

        $siteMedia = SiteMedia::create(['title' => 'Test Site', 'collection' => 'banner']);
        $spatie1 = $this->createSpatieMedia($siteMedia, [
            'name' => 'spatie-middle',
            'created_at' => now()->subHours(2),
        ]);

        $response = $this->getJson('/api/admin/system/media?source=all')->assertOk();

        $response->assertJsonCount(3, 'data');
        $data = $response->json('data');

        $this->assertSame('curator', $data[0]['source']);
        $this->assertSame($curator2->id, $data[0]['id']);

        $this->assertSame('spatie', $data[1]['source']);
        $this->assertSame($spatie1->id, $data[1]['id']);

        $this->assertSame('curator', $data[2]['source']);
        $this->assertSame($curator1->id, $data[2]['id']);

        // Check fields structure
        $this->assertArrayHasKey('url', $data[0]);
        $this->assertArrayHasKey('thumbnail_url', $data[0]);
        $this->assertArrayHasKey('folder', $data[0]);
        $this->assertArrayHasKey('collection_name', $data[1]);
        $this->assertArrayHasKey('model_type', $data[1]);
        $this->assertSame('SiteMedia', $data[1]['model_type']);
    }

    public function test_index_filters_only_curator_media_when_requested(): void
    {
        Sanctum::actingAs($this->admin);

        $this->createCuratorMedia(['name' => 'curator-only.jpg']);
        $siteMedia = SiteMedia::create(['title' => 'Test', 'collection' => 'banner']);
        $this->createSpatieMedia($siteMedia, ['name' => 'spatie-only']);

        $response = $this->getJson('/api/admin/system/media?source=curator')->assertOk();

        $response->assertJsonCount(1, 'data');
        $this->assertSame('curator', $response->json('data.0.source'));
    }

    public function test_index_filters_only_spatie_media_when_requested(): void
    {
        Sanctum::actingAs($this->admin);

        $this->createCuratorMedia(['name' => 'curator-only.jpg']);
        $siteMedia = SiteMedia::create(['title' => 'Test', 'collection' => 'banner']);
        $this->createSpatieMedia($siteMedia, ['name' => 'spatie-only']);

        $response = $this->getJson('/api/admin/system/media?source=spatie')->assertOk();

        $response->assertJsonCount(1, 'data');
        $this->assertSame('spatie', $response->json('data.0.source'));
    }

    public function test_index_pagination_with_more_than_24_records(): void
    {
        Sanctum::actingAs($this->admin);

        $siteMedia = SiteMedia::create(['title' => 'Test', 'collection' => 'banner']);

        for ($i = 1; $i <= 15; $i++) {
            $this->createCuratorMedia([
                'name' => "curator-{$i}.jpg",
                'created_at' => now()->subMinutes($i * 2),
            ]);
        }

        for ($i = 1; $i <= 15; $i++) {
            $this->createSpatieMedia($siteMedia, [
                'name' => "spatie-{$i}",
                'created_at' => now()->subMinutes($i * 2 + 1),
            ]);
        }

        // Total 30 records, default per_page = 24
        $page1 = $this->getJson('/api/admin/system/media?page=1&per_page=24')->assertOk();
        $page1->assertJsonCount(24, 'data')
            ->assertJsonPath('meta.current_page', 1)
            ->assertJsonPath('meta.total', 30)
            ->assertJsonPath('meta.last_page', 2)
            ->assertJsonPath('meta.per_page', 24);

        $page2 = $this->getJson('/api/admin/system/media?page=2&per_page=24')->assertOk();
        $page2->assertJsonCount(6, 'data')
            ->assertJsonPath('meta.current_page', 2)
            ->assertJsonPath('meta.total', 30);
    }

    public function test_destroy_spatie_media_deletes_database_row_and_physical_file(): void
    {
        Sanctum::actingAs($this->admin);

        $siteMedia = SiteMedia::create(['title' => 'Banner Site', 'collection' => 'banner']);
        $file = UploadedFile::fake()->image('hero-banner.jpg', 800, 600);
        $media = $siteMedia->addMedia($file)->toMediaCollection('banner');

        $relativePath = $media->getPathRelativeToRoot();
        Storage::disk('public')->assertExists($relativePath);

        $response = $this->deleteJson("/api/admin/system/media/spatie/{$media->id}");
        $response->assertNoContent();

        $this->assertDatabaseMissing('media', ['id' => $media->id]);
        Storage::disk('public')->assertMissing($relativePath);
    }

    public function test_destroy_curator_media_without_usages_deletes_database_row_and_physical_file(): void
    {
        Sanctum::actingAs($this->admin);

        Storage::disk('public')->put('media/unused.jpg', 'fake-image-bytes');
        Storage::disk('public')->assertExists('media/unused.jpg');

        $curator = $this->createCuratorMedia([
            'disk' => 'public',
            'path' => 'media/unused.jpg',
        ]);

        $response = $this->deleteJson("/api/admin/system/media/curator/{$curator->id}");
        $response->assertNoContent();

        $this->assertDatabaseMissing('curator_media', ['id' => $curator->id]);
        Storage::disk('public')->assertMissing('media/unused.jpg');
    }

    public function test_destroy_curator_media_fails_with_409_when_used_as_featured_image_by_breed(): void
    {
        Sanctum::actingAs($this->admin);

        Storage::disk('public')->put('media/breed.jpg', 'breed-image-bytes');
        $curator = $this->createCuratorMedia([
            'disk' => 'public',
            'path' => 'media/breed.jpg',
        ]);

        $breed = Breed::create([
            'name' => 'Golden Retriever',
            'slug' => 'golden-retriever',
            'featured_media_id' => $curator->id,
        ]);

        $response = $this->deleteJson("/api/admin/system/media/curator/{$curator->id}");

        $response->assertStatus(409)
            ->assertJsonPath('code', ErrorCode::MEDIA_IN_USE->value)
            ->assertJsonPath('message', 'This file is currently used elsewhere and cannot be deleted.')
            ->assertJsonPath('details.usages.0.type', 'Breed')
            ->assertJsonPath('details.usages.0.id', $breed->id)
            ->assertJsonPath('details.usages.0.label', 'Golden Retriever');

        // Verify FK was not set to NULL by nullOnDelete cascade
        $this->assertSame($curator->id, $breed->fresh()->featured_media_id);
        // Verify curator_media row and file still exist
        $this->assertDatabaseHas('curator_media', ['id' => $curator->id]);
        Storage::disk('public')->assertExists('media/breed.jpg');
    }

    public function test_destroy_curator_media_fails_with_409_when_used_by_solution_or_post(): void
    {
        Sanctum::actingAs($this->admin);

        Storage::disk('public')->put('media/shared.jpg', 'shared-bytes');
        $curator = $this->createCuratorMedia([
            'disk' => 'public',
            'path' => 'media/shared.jpg',
        ]);

        $solution = Solution::create([
            'name' => 'Joint Health',
            'slug' => 'joint-health',
            'featured_media_id' => $curator->id,
        ]);

        $post = Post::create([
            'title' => 'Top 10 Dog Care Tips',
            'slug' => 'top-10-dog-care-tips',
            'content' => 'Blog content...',
            'featured_media_id' => $curator->id,
        ]);

        $response = $this->deleteJson("/api/admin/system/media/curator/{$curator->id}");

        $response->assertStatus(409)
            ->assertJsonPath('code', ErrorCode::MEDIA_IN_USE->value);

        $usages = collect($response->json('details.usages'));
        $this->assertTrue($usages->contains(fn ($u) => $u['type'] === 'Solution' && $u['id'] === $solution->id && $u['label'] === 'Joint Health'));
        $this->assertTrue($usages->contains(fn ($u) => $u['type'] === 'Post' && $u['id'] === $post->id && $u['label'] === 'Top 10 Dog Care Tips'));

        $this->assertSame($curator->id, $solution->fresh()->featured_media_id);
        $this->assertSame($curator->id, $post->fresh()->featured_media_id);
        $this->assertDatabaseHas('curator_media', ['id' => $curator->id]);
    }

    public function test_destroy_curator_media_fails_with_409_when_used_indirectly_by_product_via_spatie_custom_properties(): void
    {
        Sanctum::actingAs($this->admin);

        Storage::disk('public')->put('media/product-source.jpg', 'product-image-bytes');
        $curator = $this->createCuratorMedia([
            'disk' => 'public',
            'path' => 'media/product-source.jpg',
        ]);

        $productType = ProductType::firstOrCreate(['name' => 'General']);
        $product = LunarProduct::create([
            'product_type_id' => $productType->id,
            'status' => 'published',
            'attribute_data' => [
                'name' => new Text('Calming Pet Bed'),
            ],
        ]);

        // Spatie media row copying the curator image and pointing back via custom_properties
        Media::create([
            'model_type' => LunarProduct::class,
            'model_id' => $product->id,
            'uuid' => fake()->uuid(),
            'collection_name' => 'images',
            'name' => 'calming-bed',
            'file_name' => 'calming-bed.jpg',
            'mime_type' => 'image/jpeg',
            'disk' => 'public',
            'conversions_disk' => 'public',
            'size' => 4096,
            'manipulations' => [],
            'custom_properties' => [
                'curator_media_id' => $curator->id,
                'primary' => true,
            ],
            'generated_conversions' => [],
            'responsive_images' => [],
            'order_column' => 1,
        ]);

        $response = $this->deleteJson("/api/admin/system/media/curator/{$curator->id}");

        $response->assertStatus(409)
            ->assertJsonPath('code', ErrorCode::MEDIA_IN_USE->value)
            ->assertJsonPath('details.usages.0.type', 'Product')
            ->assertJsonPath('details.usages.0.id', $product->id)
            ->assertJsonPath('details.usages.0.label', 'Calming Pet Bed');

        $this->assertDatabaseHas('curator_media', ['id' => $curator->id]);
        Storage::disk('public')->assertExists('media/product-source.jpg');
    }

    public function test_destroy_invalid_source_returns_404(): void
    {
        Sanctum::actingAs($this->admin);

        $this->deleteJson('/api/admin/system/media/invalid/1')->assertNotFound();
    }

    private function createCuratorMedia(array $attributes = []): CuratorMedia
    {
        return CuratorMedia::create(array_merge([
            'disk' => 'public',
            'directory' => 'media',
            'visibility' => 'public',
            'name' => 'sample.jpg',
            'path' => 'media/sample.jpg',
            'width' => 600,
            'height' => 400,
            'size' => 2048,
            'type' => 'image',
            'ext' => 'jpg',
            'folder' => CuratorMedia::FOLDER_GENERAL,
        ], $attributes));
    }

    private function createSpatieMedia(SiteMedia $siteMedia, array $attributes = []): Media
    {
        return Media::create(array_merge([
            'model_type' => SiteMedia::class,
            'model_id' => $siteMedia->id,
            'uuid' => fake()->uuid(),
            'collection_name' => 'banner',
            'name' => 'banner-image',
            'file_name' => 'banner-image.jpg',
            'mime_type' => 'image/jpeg',
            'disk' => 'public',
            'conversions_disk' => 'public',
            'size' => 2048,
            'manipulations' => [],
            'custom_properties' => [],
            'generated_conversions' => [],
            'responsive_images' => [],
            'order_column' => 1,
        ], $attributes));
    }
}
