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

    public function test_site_media_endpoint_caches_distinct_payloads_per_collection(): void
    {
        $banner = SiteMedia::create(['title' => 'hero', 'collection' => 'banner']);
        $this->createMedia($banner, 'banner', 'hero.jpg');
        $general = SiteMedia::create(['title' => 'footer', 'collection' => 'general']);
        $this->createMedia($general, 'general', 'footer.jpg');

        $this->getJson('/api/site-media?collection=banner')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.title', 'hero');
        $this->getJson('/api/site-media?collection=general')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.title', 'footer');

        $this->assertTrue(Cache::has('public-api:site-media:v1:banner'));
        $this->assertTrue(Cache::has('public-api:site-media:v1:general'));
        $this->assertNotSame(
            Cache::get('public-api:site-media:v1:banner'),
            Cache::get('public-api:site-media:v1:general')
        );
    }

    public function test_site_media_move_invalidates_original_and_current_collection_keys(): void
    {
        $siteMedia = SiteMedia::create(['title' => 'hero', 'collection' => 'banner']);
        Cache::put('public-api:site-media:v1:banner', ['stale-banner'], 300);
        Cache::put('public-api:site-media:v1:general', ['stale-general'], 300);

        $siteMedia->update(['collection' => 'general']);

        $this->assertFalse(Cache::has('public-api:site-media:v1:banner'));
        $this->assertFalse(Cache::has('public-api:site-media:v1:general'));
    }

    public function test_media_move_invalidates_original_and_current_collection_keys(): void
    {
        $siteMedia = SiteMedia::create(['title' => 'hero', 'collection' => 'banner']);
        $media = $this->createMedia($siteMedia, 'banner', 'hero.jpg');
        Cache::put('public-api:site-media:v1:banner', ['stale-banner'], 300);
        Cache::put('public-api:site-media:v1:general', ['stale-general'], 300);

        $media->update(['collection_name' => 'general']);

        $this->assertFalse(Cache::has('public-api:site-media:v1:banner'));
        $this->assertFalse(Cache::has('public-api:site-media:v1:general'));
    }

    public function test_media_create_and_delete_invalidate_its_collection_key(): void
    {
        $siteMedia = SiteMedia::create(['title' => 'hero', 'collection' => 'banner']);
        Cache::put('public-api:site-media:v1:banner', ['stale'], 300);
        Cache::put('public-api:site-media:v1:general', ['keep'], 300);

        $media = $this->createMedia($siteMedia, 'banner', 'hero.jpg');
        $this->assertFalse(Cache::has('public-api:site-media:v1:banner'));
        $this->assertTrue(Cache::has('public-api:site-media:v1:general'));

        Cache::put('public-api:site-media:v1:banner', ['stale'], 300);
        $media->delete();
        $this->assertFalse(Cache::has('public-api:site-media:v1:banner'));
        $this->assertTrue(Cache::has('public-api:site-media:v1:general'));
    }

    public function test_site_media_save_and_delete_invalidate_its_collection_key(): void
    {
        $banner = SiteMedia::create(['title' => 'hero', 'collection' => 'banner']);
        Cache::put('public-api:site-media:v1:banner', ['stale'], 300);
        Cache::put('public-api:site-media:v1:general', ['keep'], 300);

        $banner->update(['title' => 'updated']);
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
