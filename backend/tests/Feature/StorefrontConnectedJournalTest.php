<?php

namespace Tests\Feature;

use App\Jobs\PurgeCloudflareCache;
use App\Services\CloudflareCacheService;
use App\Services\PublicContentPurgeCoordinator;
use App\Services\StorefrontRefreshJournal;
use App\Support\StorefrontMutationBatch;
use Illuminate\Support\Facades\Bus;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Tests\Fixtures\StorefrontHtml;
use Tests\TestCase;

class StorefrontConnectedJournalTest extends TestCase
{
    private string $database;
    private array $calls = [];
    private bool $purgeFails = true;
    private string $expectedName = 'B';

    protected function setUp(): void
    {
        parent::setUp();
        $this->database = tempnam(storage_path('framework/testing'), 'connected-journal-');
        config(['database.connections.sqlite.database' => $this->database]);
        DB::purge('sqlite');
        (require database_path('migrations/2026_09_09_000001_create_storefront_refresh_journal_table.php'))->up();
        config()->set('services.storefront', ['internal_url' => 'http://127.0.0.1:3001',
            'backend_internal_url' => 'http://127.0.0.1:8001', 'revalidation_secret' => 'test-secret']);
        config()->set('services.cloudflare', ['api_token' => 'test-token', 'zone_id' => 'test-zone']);
        Bus::fake();
        Http::preventStrayRequests();
        Http::fake(function ($request) {
            $this->calls[] = $request->method().' '.$request->url();
            if (str_ends_with($request->url(), '/api/settings')) {
                $this->assertNull(Cache::get('setting:shop_name'));
                return Http::response(['status' => 'Request was successful.', 'data' => StorefrontHtml::settings($this->expectedName)]);
            }
            if (str_contains($request->url(), '/api/site-media?')) {
                return Http::response(['status' => 'Request was successful.', 'data' => []]);
            }
            if (str_contains($request->url(), '/storefront-revalidate')) {
                return Http::response(['revalidated' => true, 'scope' => 'homepage']);
            }
            if ($request->url() === 'http://127.0.0.1:3001/') {
                return Http::response(StorefrontHtml::render($this->expectedName), 200, ['Content-Type' => 'text/html', 'Cache-Control' => 'public, s-maxage=300']);
            }
            return Http::response(['success' => ! $this->purgeFails], $this->purgeFails ? 503 : 200);
        });
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

    public function test_immediate_failure_and_recovery_repeat_full_chain_from_immutable_journal_keys(): void
    {
        Cache::put('setting:shop_name', 'A');
        $batch = app(StorefrontMutationBatch::class);
        $batch->begin();
        $batch->addCommitted(['setting:shop_name']);
        $result = app(PublicContentPurgeCoordinator::class)->flushCompletedMutation();
        $this->assertFalse($result->successful);
        $row = DB::table('storefront_refresh_journal')->first();
        $this->assertSame('retry', $row->state);
        $this->assertSame(0, (int) $row->recovery_attempts);
        $this->assertCount(6, $this->calls);
        $this->purgeFails = false;
        $this->expectedName = 'C'; // Recovery must reread changed expected values, not retain B.
        Cache::put('setting:shop_name', 'refilled-old');
        $job = new PurgeCloudflareCache(['setting:wrong'], journalId: $row->id);
        $job->handle(app(CloudflareCacheService::class));
        $finished = app(StorefrontRefreshJournal::class)->find($row->id);
        $this->assertSame('completed', $finished->state);
        $this->assertSame(['setting:shop_name'], $finished->cache_keys);
        $this->assertSame(1, $finished->recovery_attempts);
        $this->assertSame(array_slice($this->calls, 0, 6), array_slice($this->calls, 6, 6));
        $job->handle(app(CloudflareCacheService::class));
        $this->assertCount(12, $this->calls);
    }

    public function test_fresh_envelopes_never_reset_four_recovery_attempts(): void
    {
        $journal = app(StorefrontRefreshJournal::class);
        $id = $journal->record(['setting:shop_name']);
        for ($attempt = 1; $attempt <= 4; $attempt++) {
            try {
                (new PurgeCloudflareCache([], journalId: $id))->handle(app(CloudflareCacheService::class));
                $this->fail('Failed purge must throw.');
            } catch (\RuntimeException) {
                $this->assertSame($attempt, $journal->find($id)->recovery_attempts);
            }
            if ($attempt < 4) {
                $this->travel([30, 120, 300][$attempt - 1])->seconds();
            }
        }
        $this->assertSame('exhausted', $journal->find($id)->state);
        (new PurgeCloudflareCache([], journalId: $id))->handle(app(CloudflareCacheService::class));
        $this->assertCount(24, $this->calls);
        $this->assertSame(4, $journal->find($id)->recovery_attempts);
        $this->travelBack();
    }
}
