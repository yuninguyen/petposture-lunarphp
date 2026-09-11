<?php

namespace Tests\Feature;

use App\Jobs\PurgeCloudflareCache;
use App\Services\CloudflareCacheService;
use App\Services\StorefrontRefreshJournal;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class StorefrontInitialClaimTest extends TestCase
{
    private string $database;

    protected function setUp(): void
    {
        parent::setUp();
        $this->database = tempnam(storage_path('framework/testing'), 'initial-claim-');
        config(['database.connections.sqlite.database' => $this->database]);
        DB::purge('sqlite');
        (require database_path('migrations/2026_09_09_000001_create_storefront_refresh_journal_table.php'))->up();
        Http::preventStrayRequests();
    }

    protected function tearDown(): void
    {
        foreach (DB::getConnections() as $connection) $connection->disconnect();
        parent::tearDown();
        gc_collect_cycles();
        unlink($this->database);
    }

    public function test_initial_null_claim_is_unconfirmed_but_duplicate_queue_envelope_can_acknowledge(): void
    {
        $journal = app(StorefrontRefreshJournal::class);
        $id = $journal->record(['setting:claim']);
        $owner = $journal->claim($id);
        $service = $this->mock(CloudflareCacheService::class);
        $service->shouldNotReceive('purgeAll');
        $job = new PurgeCloudflareCache([], journalId: $id);

        $result = $job->attemptJournal($service, true);
        $this->assertFalse($result->successful);
        $this->assertTrue($result->configured);
        $this->assertSame('leased', $journal->find($id)->state);
        $this->assertSame($owner->lease_token, $journal->find($id)->lease_token);
        $job->handle($service);
        $this->assertSame(1, $journal->find($id)->recovery_attempts);
    }

    public function test_initial_missing_journal_is_not_reported_as_completed(): void
    {
        $journal = app(StorefrontRefreshJournal::class);
        $id = $journal->record([]);
        DB::table('storefront_refresh_journal')->where('id', $id)->delete();
        $service = $this->mock(CloudflareCacheService::class);
        $service->shouldNotReceive('purgeAll');
        $this->assertFalse((new PurgeCloudflareCache([], journalId: $id))->attemptJournal($service, true)->successful);
    }
}
