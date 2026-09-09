<?php

namespace Tests\Feature;

use App\Http\Middleware\AttachCloudflarePurgeWarning;
use App\Jobs\PurgeCloudflareCache;
use App\Models\Setting;
use App\Services\PublicContentPurgeCoordinator;
use App\Services\StorefrontRefreshJournal;
use App\Support\CloudflarePurgeNotice;
use App\Support\StorefrontMutationBatch;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Bus;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use RuntimeException;
use Tests\TestCase;

class StorefrontJournalFailureTest extends TestCase
{
    private string $database;

    protected function setUp(): void
    {
        parent::setUp();
        $this->database = tempnam(storage_path('framework/testing'), 'journal-fault-');
        config(['database.connections.sqlite.database' => $this->database]);
        DB::purge('sqlite');
        $this->artisan('migrate', ['--force' => true])->assertExitCode(0);
        Bus::fake();
        Http::preventStrayRequests();
        config(['services.cloudflare.api_token' => 'test-only', 'services.cloudflare.zone_id' => 'test-zone']);
        \Tests\Fixtures\StorefrontHttp::fake(fn () => Http::response(['success' => false], 503));
    }

    protected function tearDown(): void
    {
        foreach (DB::getConnections() as $connection) {
            $connection->disconnect();
        }
        parent::tearDown();
        gc_collect_cycles();
        unlink($this->database);
    }

    private function complete(callable $mutation): Response
    {
        return app(AttachCloudflarePurgeWarning::class)->handle(
            Request::create('/api/admin/test', 'POST'),
            fn () => $mutation() ?? new Response('saved', 201),
        );
    }

    public function test_throwing_logger_cannot_skip_journaled_retry_after_saved_http_response(): void
    {
        Log::shouldReceive('warning')->andThrow(new RuntimeException('private logger failure'));
        $response = $this->complete(function () {
            Setting::create(['key' => 'journal-key', 'value' => 'committed']);
        });
        $this->assertSame(201, $response->status());
        $row = DB::table('storefront_refresh_journal')->first();
        $this->assertSame(['setting:journal-key'], json_decode($row->cache_keys, true));
        Bus::assertDispatched(PurgeCloudflareCache::class, fn ($job) => $job->journalId === $row->id);
    }

    public function test_early_eviction_failure_does_not_replace_committed_save_or_delete(): void
    {
        Cache::shouldReceive('forget')->andThrow(new RuntimeException('cache unavailable'));
        $response = $this->complete(function () {
            $setting = Setting::create(['key' => 'journal-key', 'value' => 'committed']);
            $setting->delete();
        });
        $this->assertSame(201, $response->status());
        $this->assertSame(0, Setting::count());
        $this->assertSame(['setting:journal-key'], json_decode(DB::table('storefront_refresh_journal')->first()->cache_keys, true));
        Bus::assertDispatched(PurgeCloudflareCache::class);
    }

    public function test_direct_media_move_delete_preserves_both_keys_when_early_cache_fails(): void
    {
        \Illuminate\Support\Facades\Storage::fake('public');
        $site = \App\Models\SiteMedia::withoutEvents(fn () => \App\Models\SiteMedia::create(['title' => 'Fixture', 'collection' => 'before']));
        $media = \Spatie\MediaLibrary\MediaCollections\Models\Media::withoutEvents(fn () => \Spatie\MediaLibrary\MediaCollections\Models\Media::create([
            'model_type' => $site->getMorphClass(), 'model_id' => $site->id,
            'uuid' => (string) \Illuminate\Support\Str::uuid(), 'collection_name' => 'before',
            'name' => 'hero', 'file_name' => 'hero.jpg', 'mime_type' => 'image/jpeg',
            'disk' => 'public', 'conversions_disk' => 'public', 'size' => 1,
            'manipulations' => [], 'custom_properties' => [], 'generated_conversions' => [],
            'responsive_images' => [], 'order_column' => 1,
        ]));
        Cache::shouldReceive('forget')->andThrow(new RuntimeException('cache unavailable'));
        $response = $this->complete(function () use ($media) {
            $media->update(['collection_name' => 'after']);
            $media->delete();
        });
        $this->assertSame(201, $response->status());
        $this->assertSame(0, \Spatie\MediaLibrary\MediaCollections\Models\Media::count());
        $keys = json_decode(DB::table('storefront_refresh_journal')->first()->cache_keys, true);
        $this->assertEqualsCanonicalizing(['public-api:site-media:v1:before', 'public-api:site-media:v1:after'], $keys);
        Bus::assertDispatched(PurgeCloudflareCache::class);
    }

    public function test_job_failed_logger_does_not_escape_or_reset_recovery(): void
    {
        $id = app(StorefrontRefreshJournal::class)->record(['setting:journal-key']);
        Log::shouldReceive('error')->andThrow(new RuntimeException('logger failure'));
        (new PurgeCloudflareCache([], journalId: $id))->failed(new RuntimeException('transport exhausted'));
        $this->assertSame(0, app(StorefrontRefreshJournal::class)->find($id)->recovery_attempts);
        $this->assertSame('pending', app(StorefrontRefreshJournal::class)->find($id)->state);
    }

    public function test_journal_failure_preserves_response_and_marks_recovery_unavailable_without_effects(): void
    {
        $this->mock(StorefrontRefreshJournal::class)->shouldReceive('record')->andThrow(new RuntimeException('private database failure'));
        Log::shouldReceive('critical')->andThrow(new RuntimeException('logger failure'));
        $response = $this->complete(function () {
            Setting::create(['key' => 'journal-key', 'value' => 'committed']);
        });
        $this->assertSame(201, $response->status());
        $this->assertSame('committed', Setting::value('value'));
        $this->assertSame('purge-pending', $response->headers->get('X-PetPosture-Cache-Warning'));
        $this->assertSame('unavailable', $response->headers->get('X-PetPosture-Cache-Recovery'));
        $this->assertTrue(app(CloudflarePurgeNotice::class)->isRecoveryUnavailable());
        Http::assertNothingSent();
        Bus::assertNothingDispatched();
    }

    public function test_journal_and_logger_failure_preserve_original_exception(): void
    {
        $this->mock(StorefrontRefreshJournal::class)->shouldReceive('record')->andThrow(new RuntimeException('database failure'));
        Log::shouldReceive('critical')->andThrow(new RuntimeException('logger failure'));
        $original = new RuntimeException('original handler');
        try {
            $this->complete(function () use ($original) {
                Setting::create(['key' => 'journal-key', 'value' => 'committed']);
                throw $original;
            });
            $this->fail('Expected original exception');
        } catch (RuntimeException $actual) {
            $this->assertSame($original, $actual);
        }
        $this->assertSame('committed', Setting::value('value'));
        Bus::assertNothingDispatched();
        Http::assertNothingSent();
    }

    public function test_dispatch_and_logger_failure_leave_non_http_committed_keys_after_scope_exit(): void
    {
        Bus::shouldReceive('dispatch')->andThrow(new RuntimeException('queue failure'));
        Log::shouldReceive('warning')->andThrow(new RuntimeException('logger failure'));
        DB::transaction(fn () => Setting::create(['key' => 'journal-key', 'value' => 'committed']));
        app()->forgetScopedInstances();
        $row = DB::table('storefront_refresh_journal')->first();
        $this->assertSame(['setting:journal-key'], json_decode($row->cache_keys, true));
        $this->assertSame('committed', Setting::value('value'));
        $this->assertSame(0, $row->recovery_attempts);
    }

    public function test_late_commit_dispatch_failure_retains_keys_and_rollback_is_silent(): void
    {
        Bus::shouldReceive('dispatch')->andThrow(new RuntimeException('queue failure'));
        Log::shouldReceive('warning')->andThrow(new RuntimeException('logger failure'));
        $this->complete(function () {
            DB::beginTransaction();
            Setting::create(['key' => 'journal-key', 'value' => 'committed']);
        });
        $this->assertSame(0, DB::table('storefront_refresh_journal')->count());
        DB::commit();
        $this->assertSame(['setting:journal-key'], json_decode(DB::table('storefront_refresh_journal')->first()->cache_keys, true));
        DB::beginTransaction();
        Setting::create(['key' => 'rolled-back', 'value' => 'never']);
        DB::rollBack();
        $this->assertSame(1, DB::table('storefront_refresh_journal')->count());
    }
}
