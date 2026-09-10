<?php

namespace Tests\Feature;

use App\Http\Controllers\Api\Admin\BreedController;
use App\Http\Controllers\Api\Admin\SeoSocialController;
use App\Http\Middleware\AttachCloudflarePurgeWarning;
use App\Jobs\PurgeCloudflareCache;
use App\Models\Breed;
use App\Models\Post;
use App\Models\Setting;
use App\Models\SiteMedia;
use App\Observers\PublicContentCacheObserver;
use App\Observers\SiteMediaCacheObserver;
use App\Services\CloudflareCacheService;
use App\Services\PublicContentPurgeCoordinator;
use App\Services\StorefrontRefreshJournal;
use App\Support\CloudflarePurgeNotice;
use App\Support\StorefrontMutationBatch;
use Illuminate\Database\Eloquent\Relations\Relation;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Bus;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use PHPUnit\Framework\Attributes\DataProvider;
use RuntimeException;
use Spatie\MediaLibrary\MediaCollections\Models\Media;
use Tests\TestCase;

class StorefrontRefreshTransactionTest extends TestCase
{
    private string $database;

    private static ?string $template = null;

    protected function setUp(): void
    {
        parent::setUp();
        $this->database = tempnam(storage_path('framework/testing'), 'c0-');
        config(['database.connections.sqlite.database' => $this->database]);
        DB::purge('sqlite');
        if (self::$template === null) {
            $this->artisan('migrate', ['--force' => true])->assertExitCode(0);
            DB::disconnect('sqlite');
            self::$template = tempnam(storage_path('framework/testing'), 'c0-template-');
            copy($this->database, self::$template);
        } else {
            copy(self::$template, $this->database);
        }
        config(['database.connections.committed' => config('database.connections.sqlite')]);
        Bus::fake();
        Storage::fake('public');
        Http::preventStrayRequests();
        config(['services.cloudflare.api_token' => 'test-only', 'services.cloudflare.zone_id' => 'test-zone']);
        \Tests\Fixtures\StorefrontHttp::fake();
    }

    protected function tearDown(): void
    {
        Relation::morphMap([], false);
        DB::disconnect(StorefrontRefreshJournal::CONNECTION);
        DB::disconnect('committed');
        DB::disconnect('sqlite');
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

    private function complete(callable $mutation): Response
    {
        return app(AttachCloudflarePurgeWarning::class)->handle(
            Request::create('/api/admin/test', 'POST'),
            fn () => $mutation() ?? new Response('saved'),
        );
    }

    public function test_real_settings_controller_batches_all_nontransactional_saves(): void
    {
        $seen = [];
        \Tests\Fixtures\StorefrontHttp::fake(function () use (&$seen) {
            $seen[] = DB::connection('committed')->table('settings')->pluck('value', 'key')->all();
            $this->assertFalse(Cache::has('setting:business_phone'));
            $this->assertFalse(Cache::has('setting:business_address'));
            return Http::response(['success' => true]);
        });
        $this->complete(function () {
            app(SeoSocialController::class)->store(Request::create('/', 'POST', [
                'business_phone' => '123', 'business_address' => 'Final address',
            ]));
            Setting::set('business_phone', '456');
            Http::assertNothingSent();
            Cache::put('setting:business_phone', 'stale refill');
            Cache::put('setting:business_address', 'stale refill');
        });
        $this->assertCount(1, $seen);
        $this->assertSame('456', $seen[0]['business_phone']);
        $this->assertSame('Final address', $seen[0]['business_address']);
        Bus::assertNothingDispatched();
    }

    public function test_setting_rename_retains_old_and_new_keys_until_commit(): void
    {
        $setting = Setting::query()->createQuietly(['key' => 'old', 'value' => 'A']);
        $this->complete(function () use ($setting) {
            DB::beginTransaction();
            $setting->update(['key' => 'new', 'value' => 'B']);
            Cache::put('setting:old', 'A');
            Cache::put('setting:new', 'A');
            $setting->key = 'mutated-after-event';
            Http::assertNothingSent();
            Bus::assertNothingDispatched();
            DB::commit();
            Http::assertNothingSent();
        });
        $this->assertFalse(Cache::has('setting:old'));
        $this->assertFalse(Cache::has('setting:new'));
        \Tests\Fixtures\StorefrontHttp::assertPurgeCount(1);
    }

    public function test_breed_controller_commits_final_seo_and_pivots_before_attempt(): void
    {
        $post = Post::query()->createQuietly(['title' => 'Article', 'slug' => 'article', 'content' => 'text', 'status' => 'published']);
        $seen = [];
        \Tests\Fixtures\StorefrontHttp::fake(function () use (&$seen, $post) {
            $reader = DB::connection('committed');
            $seen[] = $reader->table('breeds')->value('name');
            $this->assertSame('Final SEO', $reader->table('seo_metadata')->value('title'));
            $this->assertSame($post->id, $reader->table('post_breed')->value('post_id'));
            return Http::response(['success' => true]);
        });
        $this->complete(function () use ($post) {
            DB::beginTransaction();
            app(BreedController::class)->store(Request::create('/', 'POST', [
                'name' => 'Breed', 'slug' => 'breed', 'seo' => ['title' => 'Final SEO'], 'post_ids' => [$post->id],
            ]));
            $this->assertSame(0, DB::connection('committed')->table('breeds')->count());
            Http::assertNothingSent();
            Bus::assertNothingDispatched();
            DB::commit();
            Http::assertNothingSent();
        });
        $this->assertSame(['Breed'], $seen);
    }

    public function test_breed_controller_failure_after_save_rolls_back_without_cache_work(): void
    {
        Breed::saved(function () {
            Http::assertNothingSent();
            Bus::assertNothingDispatched();
            throw new RuntimeException('after save');
        });
        try {
            $this->complete(fn () => app(BreedController::class)->store(Request::create('/', 'POST', [
                'name' => 'Rollback', 'slug' => 'rollback', 'seo' => ['title' => 'Never saved'],
            ])));
            $this->fail('Expected injected failure');
        } catch (RuntimeException $e) {
            $this->assertSame('after save', $e->getMessage());
        }
        $this->assertSame(0, DB::connection('committed')->table('breeds')->count());
        Http::assertNothingSent();
        Bus::assertNothingDispatched();
    }

    public function test_nested_rollback_discards_only_its_callbacks(): void
    {
        app(StorefrontMutationBatch::class)->begin();
        Setting::set('independent', 'kept');
        DB::beginTransaction();
        Setting::set('outer', 'kept');
        DB::beginTransaction();
        Setting::set('inner', 'discard');
        DB::rollBack();
        DB::commit();
        $this->assertSame(['setting:independent', 'setting:outer'], app(StorefrontMutationBatch::class)->drainCacheKeys());
        $this->assertFalse(DB::connection('committed')->table('settings')->where('key', 'inner')->exists());
        Http::assertNothingSent();
        Bus::assertNothingDispatched();
    }

    public static function observerOrders(): array
    {
        return [[false], [true]];
    }

    #[DataProvider('observerOrders')]
    public function test_media_completion_is_order_independent_and_removes_precommit_refills(bool $reverse): void
    {
        SiteMedia::flushEventListeners();
        SiteMedia::observe($reverse
            ? [SiteMediaCacheObserver::class, PublicContentCacheObserver::class]
            : [PublicContentCacheObserver::class, SiteMediaCacheObserver::class]);
        $site = SiteMedia::query()->createQuietly(['title' => 'hero', 'collection' => 'banner']);
        $seen = [];
        \Tests\Fixtures\StorefrontHttp::fake(function () use (&$seen) {
            $seen[] = DB::connection('committed')->table('media')->value('collection_name');
            $this->assertFalse(Cache::has('public-api:site-media:v1:banner'));
            $this->assertFalse(Cache::has('public-api:site-media:v1:general'));
            return Http::response(['success' => true]);
        });
        $this->complete(function () use ($site) {
            DB::beginTransaction();
            $site->update(['collection' => 'general']);
            $media = $this->media($site, 'banner');
            $media->update(['collection_name' => 'general', 'generated_conversions' => ['thumb' => true]]);
            Cache::put('public-api:site-media:v1:banner', 'stale');
            Cache::put('public-api:site-media:v1:general', 'stale');
            Http::assertNothingSent();
            Bus::assertNothingDispatched();
            DB::commit();
            Http::assertNothingSent();
        });
        $this->assertSame(['general'], $seen);
    }

    public function test_direct_media_save_move_and_delete_mark_content_without_site_save(): void
    {
        Relation::morphMap(['site' => SiteMedia::class]);
        $site = SiteMedia::query()->createQuietly(['title' => 'hero', 'collection' => 'banner']);
        $this->complete(function () use ($site) {
            $media = $this->media($site, 'banner');
            $media->update(['collection_name' => 'general']);
            $media->delete();
            Cache::put('public-api:site-media:v1:banner', 'stale');
            Cache::put('public-api:site-media:v1:general', 'stale');
            Http::assertNothingSent();
        });
        \Tests\Fixtures\StorefrontHttp::assertPurgeCount(1);
        $this->assertFalse(Cache::has('public-api:site-media:v1:banner'));
        $this->assertFalse(Cache::has('public-api:site-media:v1:general'));
        $this->assertSame(0, DB::connection('committed')->table('media')->count());
    }

    public function test_non_http_commit_queues_immutable_snapshot_and_rollback_queues_nothing(): void
    {
        DB::beginTransaction();
        $setting = Setting::set('original', 'B');
        $setting->key = 'not-the-event-key';
        Http::assertNothingSent();
        Bus::assertNothingDispatched();
        DB::commit();
        Bus::assertDispatched(PurgeCloudflareCache::class, fn ($job) => $job->journalId !== null && app(StorefrontRefreshJournal::class)->find($job->journalId)?->cache_keys === ['setting:original']);
        Bus::assertDispatchedTimes(PurgeCloudflareCache::class, 1);
        DB::beginTransaction();
        Setting::set('rolled-back', 'C');
        DB::rollBack();
        Bus::assertDispatchedTimes(PurgeCloudflareCache::class, 1);
        Http::assertNothingSent();
    }

    public function test_transaction_outliving_http_scope_queues_only_when_committed(): void
    {
        $response = $this->complete(function () {
            DB::beginTransaction();
            Setting::set('late', 'B');
        });
        Http::assertNothingSent();
        Bus::assertNothingDispatched();
        $this->assertSame('purge-pending', $response->headers->get('X-PetPosture-Cache-Warning'));
        $this->assertFalse(app(StorefrontMutationBatch::class)->isCollecting());
        DB::commit();
        Bus::assertDispatched(PurgeCloudflareCache::class, fn ($job) => $job->journalId !== null && app(StorefrontRefreshJournal::class)->find($job->journalId)?->cache_keys === ['setting:late']);
        Http::assertNothingSent();
    }

    public function test_exception_after_committed_write_preserves_exception_and_flushes(): void
    {
        try {
            $this->complete(function () {
                Setting::set('committed', 'B');
                throw new RuntimeException('original failure');
            });
            $this->fail('Expected original failure');
        } catch (RuntimeException $e) {
            $this->assertSame('original failure', $e->getMessage());
        }
        $this->assertSame('B', DB::connection('committed')->table('settings')->value('value'));
        \Tests\Fixtures\StorefrontHttp::assertPurgeCount(1);
        $this->assertFalse(app(StorefrontMutationBatch::class)->isCollecting());
    }

    public function test_failure_warns_and_queues_one_snapshot_even_after_explicit_success(): void
    {
        Http::swap(new \Illuminate\Http\Client\Factory);
        Http::preventStrayRequests();
        $purges = 0;
        \Tests\Fixtures\StorefrontHttp::fake(function () use (&$purges) {
            $purges++;
            return Http::response(['success' => $purges === 1], $purges === 1 ? 200 : 500);
        });
        app(PublicContentPurgeCoordinator::class)->purge();
        $response = $this->complete(function () {
            Setting::set('one', 'B');
            Setting::set('one', 'C');
            Setting::set('two', 'D');
        });
        $this->assertSame(2, $purges);
        \Tests\Fixtures\StorefrontHttp::assertPurgeCount(2);
        $this->assertSame('saved', $response->getContent());
        $this->assertSame('purge-pending', $response->headers->get('X-PetPosture-Cache-Warning'));
        Bus::assertDispatchedTimes(PurgeCloudflareCache::class, 1);
        Bus::assertDispatched(PurgeCloudflareCache::class, fn ($job) => $job->journalId !== null && app(StorefrontRefreshJournal::class)->find($job->journalId)?->cache_keys === ['setting:one', 'setting:two']);
    }

    public function test_job_repeats_key_eviction_each_attempt_and_bounds_payload_to_known_keys(): void
    {
        $job = new PurgeCloudflareCache(['setting:one', 'setting:one', 'public-api:site-media:v1:banner', 'session:secret', 'public-api:settings:v1']);
        $this->assertSame(['setting:one', 'public-api:site-media:v1:banner'], $job->cacheKeys);
        $seen = [];
        \Tests\Fixtures\StorefrontHttp::fake(function () use (&$seen) {
            $seen[] = Cache::has('setting:one');
            return Http::response(['success' => count($seen) > 1], count($seen) > 1 ? 200 : 500);
        });
        for ($attempt = 0; $attempt < 2; $attempt++) {
            Cache::put('setting:one', 'stale');
            try {
                $job->handle(app(CloudflareCacheService::class));
            } catch (RuntimeException $e) {
                $this->assertSame(0, $attempt);
            }
        }
        $this->assertSame([false, false], $seen);
        $this->assertSame(4, $job->tries);
        $this->assertSame([30, 120, 300], $job->backoff());
    }

    public function test_named_connection_callback_is_not_attached_to_another_open_transaction(): void
    {
        app(StorefrontMutationBatch::class)->begin();
        DB::connection('sqlite')->beginTransaction();
        DB::connection('committed')->beginTransaction();
        Setting::set('writer', 'B');
        DB::connection('committed')->rollBack();
        $this->assertFalse(app(StorefrontMutationBatch::class)->hasChanges());
        DB::connection('sqlite')->commit();
        $this->assertSame(['setting:writer'], app(StorefrontMutationBatch::class)->drainCacheKeys());
    }

    public function test_cache_failure_cannot_replace_original_exception_and_retry_retains_keys(): void
    {
        $service = $this->mock(CloudflareCacheService::class);
        $service->shouldReceive('purgeAll')->once()->andThrow(new RuntimeException('cache failure'));
        try {
            $this->complete(function () {
                Setting::set('saved', 'B');
                throw new RuntimeException('original failure');
            });
        } catch (RuntimeException $e) {
            $this->assertSame('original failure', $e->getMessage());
        }
        Bus::assertDispatchedTimes(PurgeCloudflareCache::class, 1);
        Bus::assertDispatched(PurgeCloudflareCache::class, fn ($job) => $job->journalId !== null && app(StorefrontRefreshJournal::class)->find($job->journalId)?->cache_keys === ['setting:saved']);
    }

    public function test_committed_error_response_is_still_flushed(): void
    {
        $response = $this->complete(function () {
            Setting::set('saved', 'B');
            return new Response('later validation failure', 422);
        });
        $this->assertSame(422, $response->getStatusCode());
        \Tests\Fixtures\StorefrontHttp::assertPurgeCount(1);
    }

    public function test_unrelated_media_owner_does_not_mark_content(): void
    {
        $site = SiteMedia::query()->createQuietly(['title' => 'hero', 'collection' => 'banner']);
        $media = Media::withoutEvents(fn () => $this->media($site, 'banner'));
        $media->model_type = Post::class;
        $media->saveQuietly();
        $this->complete(function () use ($media) {
            $media->update(['name' => 'unrelated']);
        });
        Http::assertNothingSent();
        Bus::assertNothingDispatched();
    }

    public function test_scoped_instances_are_reset_for_next_worker_lifecycle(): void
    {
        $old = app(StorefrontMutationBatch::class);
        $old->begin();
        $old->addCommitted(['setting:old']);
        app(CloudflarePurgeNotice::class)->markPending();
        $this->app->forgetScopedInstances();
        $this->assertNotSame($old, app(StorefrontMutationBatch::class));
        $this->assertFalse(app(StorefrontMutationBatch::class)->hasChanges());
        $this->assertFalse(app(StorefrontMutationBatch::class)->isCollecting());
        $this->assertFalse(app(CloudflarePurgeNotice::class)->hasAttempted());
    }

    public function test_non_http_explicit_batch_queues_one_completed_snapshot(): void
    {
        $batch = app(StorefrontMutationBatch::class);
        $batch->begin();
        Setting::set('one', 'B');
        Setting::set('two', 'C');
        Bus::assertNothingDispatched();
        Http::assertNothingSent();
        $batch->end();
        app(PublicContentPurgeCoordinator::class)->flushCompletedMutation();
        Http::assertNothingSent();
        Bus::assertDispatchedTimes(PurgeCloudflareCache::class, 1);
        Bus::assertDispatched(PurgeCloudflareCache::class, fn ($job) => $job->journalId !== null && app(StorefrontRefreshJournal::class)->find($job->journalId)?->cache_keys === ['setting:one', 'setting:two']);
    }

    public function test_breed_update_commits_final_seo_and_pivot_removal_before_attempt(): void
    {
        $breed = Breed::query()->createQuietly(['name' => 'Old', 'slug' => 'old']);
        $post = Post::query()->createQuietly(['title' => 'Article', 'slug' => 'article', 'content' => 'text', 'status' => 'published']);
        $breed->posts()->attach($post->id);
        $breed->seo()->create(['title' => 'Old SEO']);
        $seen = [];
        \Tests\Fixtures\StorefrontHttp::fake(function () use (&$seen) {
            $reader = DB::connection('committed');
            $seen[] = [$reader->table('breeds')->value('name'), $reader->table('seo_metadata')->value('title'), $reader->table('post_breed')->count()];
            return Http::response(['success' => true]);
        });
        $this->complete(function () use ($breed) {
            app(BreedController::class)->update(Request::create('/', 'PUT', [
                'name' => 'Updated', 'slug' => 'updated', 'seo' => ['title' => 'Updated SEO'], 'post_ids' => [],
            ]), $breed);
            Http::assertNothingSent();
        });
        $this->assertSame([['Updated', 'Updated SEO', 0]], $seen);
    }

    public function test_web_request_batches_real_livewire_settings_save_without_api_warning_header(): void
    {
        \Spatie\Permission\Models\Role::firstOrCreate(['name' => 'admin', 'guard_name' => 'web']);
        $user = \App\Models\User::factory()->create(['is_active' => true]);
        $user->assignRole('admin');
        $this->actingAs($user);
        Setting::query()->createQuietly(['key' => 'shop_name', 'value' => 'Before']);
        Http::swap(new \Illuminate\Http\Client\Factory);
        Http::preventStrayRequests();
        $seen = [];
        \Tests\Fixtures\StorefrontHttp::fake(function () use (&$seen) {
            $seen[] = DB::connection('committed')->table('settings')->pluck('value', 'key')->all();
            return Http::response(['success' => false], 500);
        });
        \Illuminate\Support\Facades\Route::middleware('web')->post('/c0-settings-save', function () {
            \Livewire\Livewire::test(\App\Filament\Pages\ManageSettings::class)
                ->set('data.shop_name', 'Final shop')
                ->set('data.shop_description', 'Final description')
                ->call('save')
                ->assertHasNoFormErrors();
            Http::assertNothingSent();
            Bus::assertNothingDispatched();
            return response('saved');
        });

        $this->post('/c0-settings-save')->assertOk()->assertSee('saved')
            ->assertHeaderMissing('X-PetPosture-Cache-Warning');

        $this->assertCount(1, $seen);
        $this->assertSame('Final shop', $seen[0]['shop_name']);
        $this->assertSame('Final description', $seen[0]['shop_description']);
        Bus::assertDispatchedTimes(PurgeCloudflareCache::class, 1);
        $this->assertFalse(app(StorefrontMutationBatch::class)->isCollecting());
    }

    private function media(SiteMedia $site, string $collection): Media
    {
        return Media::create([
            'model_type' => $site->getMorphClass(), 'model_id' => $site->id,
            'uuid' => fake()->uuid(), 'collection_name' => $collection,
            'name' => 'hero', 'file_name' => 'hero.jpg', 'mime_type' => 'image/jpeg',
            'disk' => 'public', 'conversions_disk' => 'public', 'size' => 1,
            'manipulations' => [], 'custom_properties' => [], 'generated_conversions' => [],
            'responsive_images' => [], 'order_column' => 1,
        ]);
    }
}
