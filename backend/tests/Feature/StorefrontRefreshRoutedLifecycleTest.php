<?php

namespace Tests\Feature;

use App\Models\Setting;
use App\Models\User;
use App\Support\StorefrontMutationBatch;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Bus;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Illuminate\Testing\TestResponse;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

/** Real registered routes: no RefreshDatabase, controller calls, or Livewire::test wrapper. */
class StorefrontRefreshRoutedLifecycleTest extends TestCase
{
    private string $database;

    private static ?string $template = null;

    protected function setUp(): void
    {
        parent::setUp();
        $this->withoutVite();
        $this->database = tempnam(storage_path('framework/testing'), 'c0-routed-');
        config([
            'app.key' => 'base64:'.base64_encode(str_repeat('t', 32)),
            'database.default' => 'sqlite',
            'database.connections.sqlite.database' => $this->database,
            'database.connections.sqlite.url' => null,
            'cache.default' => 'array',
            'session.driver' => 'array',
            'queue.default' => 'sync',
            'filament.default_filesystem_disk' => 'public',
            'media-library.disk_name' => 'public',
            'livewire.temporary_file_upload.disk' => 'local',
            'services.cloudflare.api_token' => 'test-only',
            'services.cloudflare.zone_id' => 'test-zone',
        ]);
        DB::purge('sqlite');
        if (self::$template === null) {
            $this->artisan('migrate', ['--force' => true])->assertExitCode(0);
            DB::disconnect('sqlite');
            self::$template = tempnam(storage_path('framework/testing'), 'c0-routed-template-');
            copy($this->database, self::$template);
        } else {
            copy(self::$template, $this->database);
        }
        config(['database.connections.routed_committed' => config('database.connections.sqlite')]);
        Bus::fake();
        Storage::fake('public');
        Storage::fake('local');
        Storage::fake('tmp-for-tests');
        Http::preventStrayRequests();
        \Tests\Fixtures\StorefrontHttp::fake();
        Role::firstOrCreate(['name' => 'admin', 'guard_name' => 'web']);
        $user = User::factory()->create(['is_active' => true]);
        $user->assignRole('admin');
        $this->actingAs($user);
        $this->assertSame(0, DB::transactionLevel());
        $this->assertNotSame(DB::connection()->getPdo(), DB::connection('routed_committed')->getPdo());
    }

    protected function tearDown(): void
    {
        // Disconnect all aliases, including the implementation's independent journal PDO.
        foreach (DB::getConnections() as $connection) {
            $connection->disconnect();
        }
        parent::tearDown();
        gc_collect_cycles();
        if (isset($this->database)) {
            unlink($this->database);
        }
    }

    public static function tearDownAfterClass(): void
    {
        if (self::$template !== null) {
            unlink(self::$template);
            self::$template = null;
        }
        parent::tearDownAfterClass();
    }

    public function test_registered_api_completes_one_batch_after_all_settings_are_committed(): void
    {
        Setting::query()->createQuietly(['key' => 'business_phone', 'value' => 'Before']);
        $seen = [];
        \Tests\Fixtures\StorefrontHttp::fake(function () use (&$seen) {
            $seen[] = DB::connection('routed_committed')->table('settings')->pluck('value', 'key')->all();
            $this->assertFalse(Cache::has('setting:business_phone'));
            $this->assertFalse(Cache::has('setting:business_address'));
            return Http::response(['success' => true]);
        });
        Cache::put('setting:business_phone', 'Before');
        Cache::put('setting:business_address', 'Before');

        $this->postJson('/api/admin/seo-social', [
            'business_phone' => '123', 'business_address' => 'Final address',
        ])->assertOk()->assertExactJson(['message' => 'SEO & Social settings updated successfully.'])
            ->assertHeaderMissing('X-PetPosture-Cache-Warning')
            ->assertHeaderMissing('X-PetPosture-Cache-Recovery');

        $this->assertCount(1, $seen);
        $this->assertSame('123', $seen[0]['business_phone']);
        $this->assertSame('Final address', $seen[0]['business_address']);
        $this->assertCompletedBatch(['setting:business_phone', 'setting:business_address']);
    }

    public function test_raw_livewire_settings_save_completes_after_all_committed_values(): void
    {
        Setting::query()->createQuietly(['key' => 'shop_name', 'value' => 'Before']);
        $snapshot = $this->pageSnapshot('/admin/manage-settings', 'manage-settings');
        Http::assertNothingSent();
        $seen = [];
        \Tests\Fixtures\StorefrontHttp::fake(function () use (&$seen) {
            $seen[] = DB::connection('routed_committed')->table('settings')->pluck('value', 'key')->all();
            $this->assertFalse(Cache::has('setting:shop_name'));
            $this->assertFalse(Cache::has('setting:shop_description'));
            return Http::response(['success' => true]);
        });
        Cache::put('setting:shop_name', 'Before');
        Cache::put('setting:shop_description', 'Before');

        $response = $this->update($snapshot, [
            'data.shop_name' => 'Final shop', 'data.shop_description' => 'Final description',
        ], [['method' => 'save', 'params' => []]]);
        $this->assertNoLivewireErrors($response);
        $this->assertSame('Final shop', DB::connection('routed_committed')->table('settings')->where('key', 'shop_name')->value('value'));
        $this->assertSame('Final description', DB::connection('routed_committed')->table('settings')->where('key', 'shop_description')->value('value'));
        $this->assertCount(1, $seen);
        $this->assertSame('Final shop', $seen[0]['shop_name']);
        $this->assertSame('Final description', $seen[0]['shop_description']);
        // The real form also persists its default AI provider; compare the whole committed key set.
        $keys = array_map(fn ($key) => 'setting:'.$key, array_keys($seen[0]));
        $this->assertCompletedBatch($keys);
    }

    public function test_raw_livewire_create_media_finishes_all_uploads_before_one_final_attempt(): void
    {
        $snapshot = $this->pageSnapshot('/admin/media/create', 'create-media');
        $files = [UploadedFile::fake()->image('hero.png', 4, 4), UploadedFile::fake()->image('promo.png', 4, 4)];
        $start = $this->update($snapshot, [], [[
            'method' => '_startUpload',
            'params' => ['data.files', array_map(fn ($file) => [
                'name' => $file->getClientOriginalName(), 'size' => $file->getSize(), 'type' => 'image/png',
            ], $files), true],
        ]]);
        $event = collect($start->json('components.0.effects.dispatches'))
            ->firstWhere('name', 'upload:generatedSignedUrl');
        $this->assertNotNull($event, 'Real upload handshake must return a signed upload URL.');
        $uploaded = $this->post($event['params']['url'], ['files' => $files], ['Accept' => 'application/json'])->assertOk();
        $paths = $uploaded->json('paths');
        $this->assertCount(2, $paths);
        $finish = $this->update($start->json('components.0.snapshot'), [], [[
            'method' => '_finishUpload', 'params' => ['data.files', $paths, true],
        ]]);
        $this->assertNoLivewireErrors($finish);
        Http::assertNothingSent();
        Bus::assertNothingDispatched();
        $this->assertSame(0, DB::connection('routed_committed')->table('site_media')->count());

        $seen = [];
        \Tests\Fixtures\StorefrontHttp::fake(function () use (&$seen) {
            $reader = DB::connection('routed_committed');
            $seen[] = $reader->table('media')->orderBy('id')->get();
            $this->assertSame('Final hero', $reader->table('site_media')->value('title'));
            $this->assertSame('banner', $reader->table('site_media')->value('collection'));
            $this->assertCount(2, end($seen));
            foreach (end($seen) as $media) {
                $this->assertSame('banner', $media->collection_name);
                Storage::disk('public')->assertExists($media->id.'/'.$media->file_name);
            }
            // Spatie moved each Filament-stored source into its final media directory.
            $this->assertCount(2, Storage::disk('public')->allFiles());
            $this->assertFalse(Cache::has('public-api:site-media:v1:banner'));
            $this->assertSame('unrelated', Cache::get('public-api:site-media:v1:general'));
            return Http::response(['success' => true]);
        });
        Cache::put('public-api:site-media:v1:banner', 'Before');
        Cache::put('public-api:site-media:v1:general', 'unrelated');

        $saved = $this->update($finish->json('components.0.snapshot'), [
            'data.title' => 'Final hero', 'data.collection' => 'banner',
        ], [['method' => 'save', 'params' => []]]);
        $this->assertNoLivewireErrors($saved);
        $this->assertNotEmpty($saved->json('components.0.effects.redirect'));
        $this->assertSame(2, DB::connection('routed_committed')->table('media')->count());
        $this->assertSame('Final hero', DB::connection('routed_committed')->table('site_media')->value('title'));
        $this->assertCount(2, Storage::disk('public')->allFiles());
        $this->assertCount(1, $seen);
        $this->assertCompletedBatch(['public-api:site-media:v1:banner']);
    }

    private function pageSnapshot(string $url, string $componentSuffix): string
    {
        $html = $this->get($url)->assertOk()->getContent();
        preg_match_all('/wire:snapshot="([^"]+)"/', $html, $matches);
        foreach ($matches[1] as $encoded) {
            $snapshot = html_entity_decode($encoded, ENT_QUOTES | ENT_HTML5, 'UTF-8');
            $decoded = json_decode($snapshot, true, 512, JSON_THROW_ON_ERROR);
            if (str_ends_with($decoded['memo']['name'], $componentSuffix)) {
                return $snapshot;
            }
        }
        $this->fail('Registered Filament page did not render the expected signed component snapshot.');
    }

    private function update(string $snapshot, array $updates, array $calls): TestResponse
    {
        return $this->postJson('/livewire/update', ['components' => [[
            'snapshot' => $snapshot, 'updates' => (object) $updates,
            'calls' => array_map(fn ($call) => ['path' => '', ...$call], $calls),
        ]]], ['X-Livewire' => 'true'])->assertOk()
            ->assertHeaderMissing('X-PetPosture-Cache-Warning')
            ->assertHeaderMissing('X-PetPosture-Cache-Recovery');
    }

    private function assertNoLivewireErrors(TestResponse $response): void
    {
        $snapshot = json_decode($response->json('components.0.snapshot'), true, 512, JSON_THROW_ON_ERROR);
        $this->assertEmpty($snapshot['memo']['errors'] ?? []);
    }

    private function assertCompletedBatch(array $keys): void
    {
        \Tests\Fixtures\StorefrontHttp::assertPurgeCount(1);
        Bus::assertNothingDispatched();
        $this->assertFalse(app(StorefrontMutationBatch::class)->isCollecting());
        $this->assertSame(0, DB::transactionLevel());
        $this->assertTrue(Schema::connection('routed_committed')->hasTable('storefront_refresh_journal'),
            'A completed routed mutation must durably record its batch, not only purge in memory.');
        $rows = DB::connection('routed_committed')->table('storefront_refresh_journal')->get();
        $this->assertCount(1, $rows, 'One immutable journal row must cover the final completed operation.');
        $row = $rows->first();
        $this->assertEqualsCanonicalizing($keys, json_decode($row->cache_keys, true, 512, JSON_THROW_ON_ERROR));
        $this->assertSame('completed', $row->state);
        $this->assertNotNull($row->completed_at);
        $this->assertSame(0, (int) $row->recovery_attempts);
        $this->assertTrue((bool) $row->initial_attempted);
    }
}
