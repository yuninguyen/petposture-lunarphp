<?php

namespace Tests\Feature;

use App\Models\SiteMedia;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Storage;
use Spatie\MediaLibrary\MediaCollections\Models\Media;
use Tests\TestCase;

class SiteMediaApiTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('public');
    }

    public function test_site_media_response_is_cached_per_collection_and_preserves_payload_shape(): void
    {
        $siteMedia = SiteMedia::create(['title' => 'hero', 'collection' => 'banner']);
        $this->createMedia($siteMedia, 'banner', 'hero.jpg');

        $first = $this->getJson('/api/site-media?collection=banner')
            ->assertOk()
            ->assertJsonPath('data.0.title', 'hero')
            ->assertJsonStructure(['status', 'message', 'data' => [['title', 'url']]]);

        $this->assertTrue(Cache::has('public-api:site-media:v1:banner'));

        SiteMedia::withoutEvents(fn () => $siteMedia->update(['title' => 'database-only']));

        $second = $this->getJson('/api/site-media?collection=banner')->assertOk();
        $this->assertSame($first->json(), $second->json());
    }

    public function test_site_media_save_delete_and_media_update_invalidate_only_its_collection_key(): void
    {
        $banner = SiteMedia::create(['title' => 'hero', 'collection' => 'banner']);
        $media = $this->createMedia($banner, 'banner', 'hero.jpg');

        Cache::put('public-api:site-media:v1:banner', ['stale'], 300);
        Cache::put('public-api:site-media:v1:general', ['keep'], 300);

        $banner->update(['title' => 'updated']);
        $this->assertFalse(Cache::has('public-api:site-media:v1:banner'));
        $this->assertTrue(Cache::has('public-api:site-media:v1:general'));

        Cache::put('public-api:site-media:v1:banner', ['stale'], 300);
        $media->update(['file_name' => 'updated.jpg']);
        $this->assertFalse(Cache::has('public-api:site-media:v1:banner'));
        $this->assertTrue(Cache::has('public-api:site-media:v1:general'));

        Cache::put('public-api:site-media:v1:banner', ['stale'], 300);
        $banner->delete();
        $this->assertFalse(Cache::has('public-api:site-media:v1:banner'));
        $this->assertTrue(Cache::has('public-api:site-media:v1:general'));
    }

    private function createMedia(SiteMedia $siteMedia, string $collection, string $fileName): Media
    {
        return Media::create([
            'model_type' => SiteMedia::class,
            'model_id' => $siteMedia->getKey(),
            'uuid' => fake()->uuid(),
            'collection_name' => $collection,
            'name' => pathinfo($fileName, PATHINFO_FILENAME),
            'file_name' => $fileName,
            'mime_type' => 'image/jpeg',
            'disk' => 'public',
            'conversions_disk' => 'public',
            'size' => 1,
            'manipulations' => [],
            'custom_properties' => [],
            'generated_conversions' => [],
            'responsive_images' => [],
            'order_column' => 1,
        ]);
    }
}
