<?php

namespace Tests\Feature;

use App\Jobs\PurgeCloudflareCache;
use App\Services\CloudflareCacheService;
use App\Services\StorefrontRefreshJournal;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use RuntimeException;
use Tests\TestCase;

class JournalFaultEvidenceTest extends TestCase
{
    private string $database;

    protected function setUp(): void
    {
        parent::setUp();
        $this->database = tempnam(storage_path('framework/testing'), 'journal-evidence-');
        config(['database.connections.sqlite.database' => $this->database]);
        DB::purge('sqlite');
        (require database_path('migrations/2026_09_09_000001_create_storefront_refresh_journal_table.php'))->up();
    }

    protected function tearDown(): void
    {
        foreach (DB::getConnections() as $connection) $connection->disconnect();
        parent::tearDown();
        gc_collect_cycles();
        unlink($this->database);
    }

    public function test_insert_acknowledgement_failure_recovers_same_committed_id_and_keys(): void
    {
        $j = app(StorefrontRefreshJournal::class);
        $j->record([]); // initialize independent J before installing one-shot acknowledgement fault
        $thrown = false;
        DB::connection($j::CONNECTION)->listen(function ($query) use (&$thrown) {
            if (! $thrown && str_starts_with(strtolower($query->sql), 'insert')) {
                $thrown = true;
                throw new RuntimeException('ack lost after insert');
            }
        });
        $id = (string) \Illuminate\Support\Str::uuid();
        $this->assertSame($id, $j->record(['setting:old', 'setting:new'], $id));
        $this->assertTrue($thrown);
        $this->assertSame(['setting:old', 'setting:new'], $j->find($id)->cache_keys);
        $this->assertSame(1, DB::table('storefront_refresh_journal')->where('id', $id)->count());
    }

    public function test_pre_journal_serialized_envelope_executes_without_journal_recording(): void
    {
        \Tests\Fixtures\StorefrontHttp::fake();
        // Literal old payload: only the pre-journal public keys field, no journalId/timeout.
        $payload = 'O:29:"App\\Jobs\\PurgeCloudflareCache":1:{s:9:"cacheKeys";a:1:{i:0;s:14:"setting:legacy";}}';
        $job = unserialize($payload, ['allowed_classes' => [PurgeCloudflareCache::class]]);
        $this->assertInstanceOf(PurgeCloudflareCache::class, $job);
        $this->assertNull($job->journalId);
        Cache::put('setting:legacy', 'stale');
        $service = $this->mock(CloudflareCacheService::class);
        $service->shouldReceive('purgeAll')->once()->andReturnUsing(function () {
            $this->assertFalse(Cache::has('setting:legacy'));
            return new \App\ValueObjects\CloudflarePurgeResult(true, true);
        });
        $job->handle($service);
        $this->assertSame(0, DB::table('storefront_refresh_journal')->count());
    }
}
