<?php

namespace Tests\Feature;

use App\Jobs\PurgeCloudflareCache;
use App\Models\Setting;
use App\Models\SiteMedia;
use App\Observers\PublicContentCacheObserver;
use App\Observers\SiteMediaCacheObserver;
use App\Services\CloudflareCacheService;
use App\Services\PublicContentPurgeCoordinator;
use App\Services\StorefrontRefreshJournal;
use App\Support\CloudflarePurgeNotice;
use App\Support\StorefrontMutationBatch;
use Illuminate\Support\Facades\Bus;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use PHPUnit\Framework\Attributes\DataProvider;
use RuntimeException;
use Spatie\MediaLibrary\MediaCollections\Models\Media;
use Tests\TestCase;

/** Injected same-process local boundaries, not process-kill or queue-ack proof. */
class JournalFinalLocalAcceptanceTest extends TestCase
{
    private string $database;
    private static ?string $template = null;

    protected function setUp(): void
    {
        parent::setUp();
        $this->database = tempnam(storage_path('framework/testing'), 'journal-final-');
        config(['database.connections.sqlite.database' => $this->database]);
        DB::purge('sqlite');
        if (self::$template === null) {
            $this->artisan('migrate', ['--force' => true])->assertExitCode(0);
            DB::disconnect('sqlite');
            self::$template = tempnam(storage_path('framework/testing'), 'journal-final-template-');
            copy($this->database, self::$template);
        } else {
            copy(self::$template, $this->database);
        }
        config(['database.connections.committed' => config('database.connections.sqlite')]);
        config(['services.cloudflare.api_token' => 'test-only', 'services.cloudflare.zone_id' => 'test-zone']);
        Bus::fake();
        Storage::fake('public');
        Http::preventStrayRequests();
        $this->freezeTime();
    }

    protected function tearDown(): void
    {
        $this->travelBack();
        SiteMedia::flushEventListeners();
        SiteMedia::observe([PublicContentCacheObserver::class, SiteMediaCacheObserver::class]);
        foreach (DB::getConnections() as $connection) {
            $connection->disconnect();
        }
        parent::tearDown();
        gc_collect_cycles();
        unlink($this->database);
    }

    public static function tearDownAfterClass(): void
    {
        if (self::$template !== null) {
            unlink(self::$template);
            self::$template = null;
        }
        parent::tearDownAfterClass();
    }

    public static function earlyFaultCases(): array
    {
        return [
            'setting rename' => ['setting', false, 'autocommit', false, ['setting:old', 'setting:new']],
            'setting delete' => ['setting', true, 'autocommit', false, ['setting:old']],
            'direct media move' => ['media', false, 'autocommit', false, ['public-api:site-media:v1:before', 'public-api:site-media:v1:after']],
            'direct media delete' => ['media', true, 'autocommit', false, ['public-api:site-media:v1:before']],
            'site public-first autocommit' => ['site', false, 'autocommit', false, ['public-api:site-media:v1:before', 'public-api:site-media:v1:after']],
            'site cache-first autocommit' => ['site', false, 'autocommit', true, ['public-api:site-media:v1:before', 'public-api:site-media:v1:after']],
            'site public-first commit' => ['site', false, 'commit', false, ['public-api:site-media:v1:before', 'public-api:site-media:v1:after']],
            'site cache-first commit' => ['site', false, 'commit', true, ['public-api:site-media:v1:before', 'public-api:site-media:v1:after']],
            'site public-first rollback' => ['site', false, 'rollback', false, ['public-api:site-media:v1:before', 'public-api:site-media:v1:after']],
            'site cache-first rollback' => ['site', false, 'rollback', true, ['public-api:site-media:v1:before', 'public-api:site-media:v1:after']],
        ];
    }

    #[DataProvider('earlyFaultCases')]
    public function test_one_shot_early_eviction_preserves_snapshot_and_eventual_effects(string $kind, bool $delete, string $transaction, bool $reverse, array $keys): void
    {
        SiteMedia::flushEventListeners();
        SiteMedia::observe($reverse
            ? [SiteMediaCacheObserver::class, PublicContentCacheObserver::class]
            : [PublicContentCacheObserver::class, SiteMediaCacheObserver::class]);
        if ($kind === 'setting') {
            $model = Setting::query()->createQuietly(['key' => 'old', 'value' => 'before']);
            $column = 'key';
            $original = 'old';
            $current = 'new';
        } else {
            $site = SiteMedia::query()->createQuietly(['title' => 'hero', 'collection' => 'before']);
            $model = $kind === 'site' ? $site : Media::withoutEvents(fn () => Media::create([
                'model_type' => $site->getMorphClass(), 'model_id' => $site->id,
                'uuid' => fake()->uuid(), 'collection_name' => 'before',
                'name' => 'hero', 'file_name' => 'hero.jpg', 'mime_type' => 'image/jpeg',
                'disk' => 'public', 'conversions_disk' => 'public', 'size' => 1,
                'manipulations' => [], 'custom_properties' => [], 'generated_conversions' => [],
                'responsive_images' => [], 'order_column' => 1,
            ]));
            $column = $kind === 'site' ? 'collection' : 'collection_name';
            $original = 'before';
            $current = 'after';
        }
        $reader = DB::connection('committed')->table($model->getTable())->where('id', $model->getKey());
        $batch = app(StorefrontMutationBatch::class);
        $batch->begin();
        foreach ($keys as $key) Cache::put($key, 'stale before mutation');
        $manager = Cache::getFacadeRoot();
        $store = $manager->store();
        $failures = 0;
        $forgotten = [];
        Cache::partialMock()->shouldReceive('forget')->andReturnUsing(function ($key) use ($store, &$failures, &$forgotten) {
            $forgotten[] = $key;
            if ($failures === 0) {
                $failures++;
                throw new RuntimeException('one-shot early eviction');
            }
            return $store->forget($key);
        });
        try {
            if ($transaction !== 'autocommit') DB::beginTransaction();
            $this->assertTrue($delete ? $model->delete() : $model->update([$column => $current]));
            $this->assertSame(1, $failures);
            $this->assertSame($keys, $forgotten);
            $this->assertTrue($store->has($keys[0]));
            foreach (array_slice($keys, 1) as $key) $this->assertFalse($store->has($key));
            // Destroy mutable event attributes before callbacks/handoff can read them again.
            $model->$column = 'not-the-event-key';
            $this->assertSame(0, DB::connection('committed')->table('storefront_refresh_journal')->count());
            Bus::assertNothingDispatched();
            Http::assertNothingSent();
            if ($transaction !== 'autocommit') {
                $this->assertSame($original, $reader->value($column));
                if ($transaction === 'rollback') DB::rollBack();
                else DB::commit();
            }
            $this->assertSame($transaction === 'rollback' ? $original : ($delete ? null : $current), $reader->value($column));
            foreach ($keys as $key) $store->put($key, 'refilled before completion');
            $batch->end();
            app(PublicContentPurgeCoordinator::class)->flushCompletedMutation();
            if ($transaction === 'rollback') {
                $this->assertSame(0, DB::connection('committed')->table('storefront_refresh_journal')->count());
                Bus::assertNothingDispatched();
                Http::assertNothingSent();
                return;
            }
            $row = DB::connection('committed')->table('storefront_refresh_journal')->sole();
            $this->assertSame($keys, json_decode($row->cache_keys, true));
            Bus::assertDispatchedTimes(PurgeCloudflareCache::class, 1);
            $job = Bus::dispatched(PurgeCloudflareCache::class)->sole();
            $this->assertSame($row->id, $job->journalId);
            Cache::swap($manager);
            $this->successfulEffects($keys);
            $job->handle(app(CloudflareCacheService::class));
            Http::assertSentCount(1);
            $this->assertSame(1, $failures);
            $this->assertSame('completed', app(StorefrontRefreshJournal::class)->find($row->id)->state);
        } finally {
            Cache::swap($manager);
        }
    }

    public function test_registered_replay_reclaims_expired_recovery_without_budget_reset(): void
    {
        $journal = app(StorefrontRefreshJournal::class);
        $keys = ['setting:old', 'setting:new'];
        $id = $journal->record($keys);
        $claim = $journal->claim($id);
        $this->assertSame(1, $claim->recovery_attempts);
        $this->travel(120)->seconds();
        $this->replayCommand();
        $row = $journal->find($id);
        $this->assertSame('retry', $row->state);
        $this->assertSame(1, $row->recovery_attempts);
        $this->assertNull($row->lease_token);
        $this->assertNull($row->lease_expires_at);
        $this->assertFalse($journal->finish($id, $claim->lease_token, true, 'success'));
        Bus::assertNothingDispatched();
        Http::assertNothingSent();
        $this->travel(30)->seconds();
        $this->replayCommand();
        Bus::assertDispatchedTimes(PurgeCloudflareCache::class, 1);
        $job = Bus::dispatched(PurgeCloudflareCache::class)->sole();
        $this->assertSame($id, $job->journalId);
        $this->assertSame($keys, $journal->find($id)->cache_keys);
        $this->assertSame(1, $journal->find($id)->recovery_attempts);
        foreach ($keys as $key) Cache::put($key, 'stale refill');
        $this->successfulEffects($keys, function () use ($journal, $id) {
            $this->assertSame(2, $journal->find($id)->recovery_attempts);
            $this->assertSame('leased', $journal->find($id)->state);
        });
        $job->handle(app(CloudflareCacheService::class));
        Http::assertSentCount(1);
        $this->assertSame('completed', $journal->find($id)->state);
        $this->assertSame(2, $journal->find($id)->recovery_attempts);
        $this->assertFalse($journal->finish($id, $claim->lease_token, true, 'success'));
        $this->assertSame(1, DB::connection('committed')->table('storefront_refresh_journal')->count());
    }

    public function test_prejournal_interruption_leaves_committed_content_without_replay_fact(): void
    {
        $setting = Setting::query()->createQuietly(['key' => 'old', 'value' => 'before']);
        app(StorefrontMutationBatch::class)->begin();
        DB::transaction(fn () => $setting->update(['key' => 'new', 'value' => 'committed']));
        $this->assertSame('committed', DB::connection('committed')->table('settings')->where('key', 'new')->value('value'));
        $this->assertTrue(app(StorefrontMutationBatch::class)->hasChanges());
        $this->assertFalse(app(CloudflarePurgeNotice::class)->hasAttempted());
        $this->assertSame(0, DB::connection('committed')->table('storefront_refresh_journal')->count());
        Bus::assertNothingDispatched();
        Http::assertNothingSent();
        // Deliberately omit end/flush and middleware finally: injected local boundary only.
        app()->forgetScopedInstances();
        DB::purge(StorefrontRefreshJournal::CONNECTION);
        $this->assertFalse(app(StorefrontMutationBatch::class)->hasChanges());
        $this->assertFalse(app(CloudflarePurgeNotice::class)->hasAttempted());
        foreach (['setting:old', 'setting:new'] as $key) Cache::put($key, 'unrecoverable refill');
        $this->replayCommand();
        $this->assertSame(['selected' => 0, 'submitted' => 0, 'deferred' => 0, 'failed' => 0], app(StorefrontRefreshJournal::class)->replaySummary());
        $this->assertSame(0, DB::connection(StorefrontRefreshJournal::CONNECTION)->table('storefront_refresh_journal')->count());
        Bus::assertNothingDispatched();
        Http::assertNothingSent();
        $this->assertSame('unrecoverable refill', Cache::get('setting:old'));
        $this->assertSame('unrecoverable refill', Cache::get('setting:new'));
    }

    public function test_dispatch_without_worker_is_replayed_after_throttle(): void
    {
        $journal = app(StorefrontRefreshJournal::class);
        $keys = ['setting:old', 'setting:new'];
        $id = $journal->record($keys);
        $this->assertTrue($journal->dispatch($id));
        $original = Bus::dispatched(PurgeCloudflareCache::class)->sole();
        app()->forgetScopedInstances();
        DB::purge(StorefrontRefreshJournal::CONNECTION);
        $journal = app(StorefrontRefreshJournal::class);
        $this->assertSame('pending', $journal->find($id)->state);
        $this->assertSame(0, $journal->find($id)->recovery_attempts);
        $this->replayCommand();
        Bus::assertDispatchedTimes(PurgeCloudflareCache::class, 1);
        Http::assertNothingSent();
        $this->travel(30)->seconds();
        $this->replayCommand();
        Bus::assertDispatchedTimes(PurgeCloudflareCache::class, 2);
        $replacement = Bus::dispatched(PurgeCloudflareCache::class)->last();
        $this->assertNotSame($original, $replacement);
        $this->assertSame($id, $original->journalId);
        $this->assertSame($id, $replacement->journalId);
        $this->assertSame($keys, $journal->find($id)->cache_keys);
        $this->assertSame('pending', $journal->find($id)->state);
        $this->assertSame(0, $journal->find($id)->recovery_attempts);
        foreach ($keys as $key) Cache::put($key, 'refill');
        $this->successfulEffects($keys);
        $original->handle(app(CloudflareCacheService::class));
        $this->assertSame('completed', $journal->find($id)->state);
        foreach ($keys as $key) Cache::put($key, 'fresh after completion');
        $replacement->handle(app(CloudflareCacheService::class));
        Http::assertSentCount(1);
        $this->assertSame(1, $journal->find($id)->recovery_attempts);
        foreach ($keys as $key) $this->assertSame('fresh after completion', Cache::get($key));
    }

    public function test_completed_unacknowledged_envelope_redelivery_has_no_effects(): void
    {
        $journal = app(StorefrontRefreshJournal::class);
        $keys = ['setting:old', 'setting:new'];
        $id = $journal->record($keys);
        $this->assertTrue($journal->dispatch($id));
        $envelope = Bus::dispatched(PurgeCloudflareCache::class)->sole();
        foreach ($keys as $key) Cache::put($key, 'refill');
        $this->successfulEffects($keys);
        $envelope->handle(app(CloudflareCacheService::class));
        $completed = $journal->find($id);
        $this->assertSame('completed', $completed->state);
        $this->assertNotNull($completed->completed_at);
        $this->assertSame(1, $completed->recovery_attempts);
        Http::assertSentCount(1);
        app()->forgetScopedInstances();
        DB::purge(StorefrontRefreshJournal::CONNECTION);
        Bus::fake();
        Http::swap(new \Illuminate\Http\Client\Factory);
        Http::preventStrayRequests();
        foreach ($keys as $key) Cache::put($key, 'fresh after completion');
        $envelope->handle(app(CloudflareCacheService::class));
        $this->replayCommand();
        $row = app(StorefrontRefreshJournal::class)->find($id);
        $this->assertEquals($completed, $row);
        $this->assertNull($row->lease_token);
        $this->assertNull($row->lease_expires_at);
        foreach ($keys as $key) $this->assertSame('fresh after completion', Cache::get($key));
        Http::assertNothingSent();
        Bus::assertNothingDispatched();
    }

    private function replayCommand(): void
    {
        $this->artisan('storefront:refresh-replay', ['--limit' => 100, '--max-seconds' => 20])->assertExitCode(0);
    }

    private function successfulEffects(array $keys, ?callable $inside = null): void
    {
        Http::fake(function () use ($keys, $inside) {
            foreach ($keys as $key) $this->assertFalse(Cache::has($key), 'Refresh must see every captured key evicted');
            if ($inside !== null) $inside();
            return Http::response(['success' => true]);
        });
    }
}
