<?php

namespace Tests\Feature;

use App\Jobs\PurgeCloudflareCache;
use App\Services\StorefrontRefreshJournal;
use Illuminate\Support\Facades\Bus;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use InvalidArgumentException;
use RuntimeException;
use Tests\TestCase;

class StorefrontRefreshJournalTest extends TestCase
{
    private string $database;
    private static ?string $template = null;

    protected function setUp(): void
    {
        parent::setUp();
        $this->database = tempnam(storage_path('framework/testing'), 'journal-');
        config(['database.connections.sqlite.database' => $this->database]);
        DB::purge('sqlite');
        if (self::$template === null) {
            $this->artisan('migrate', ['--force' => true])->assertExitCode(0);
            DB::disconnect('sqlite');
            self::$template = tempnam(storage_path('framework/testing'), 'journal-template-');
            copy($this->database, self::$template);
        } else {
            copy(self::$template, $this->database);
        }
        Bus::fake();
        Http::preventStrayRequests();
    }

    protected function tearDown(): void
    {
        $this->travelBack();
        DB::purge('storefront_refresh_journal');
        DB::purge('sqlite');
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

    public function test_record_is_immutable_idempotent_and_survives_default_rollback_on_distinct_pdo(): void
    {
        $journal = app(StorefrontRefreshJournal::class);
        DB::beginTransaction();
        $id = $journal->record(['setting:new', 'setting:old', 'setting:new']);
        $this->assertNotSame(DB::connection()->getPdo(), DB::connection($journal::CONNECTION)->getPdo());
        $this->assertSame(0, DB::connection($journal::CONNECTION)->transactionLevel());
        DB::rollBack();
        $this->assertSame(['setting:new', 'setting:old'], $journal->find($id)->cache_keys);
        $this->assertSame($id, $journal->record(['setting:old', 'setting:new'], $id));
        $this->expectException(InvalidArgumentException::class);
        $journal->record(['setting:different'], $id);
    }

    public function test_invalid_snapshot_rejected_instead_of_silently_dropping_keys(): void
    {
        $journal = app(StorefrontRefreshJournal::class);
        foreach (['session:key', 'setting:', 'setting:has space', 'setting:'.str_repeat('x', 256), 12] as $invalid) {
            try {
                $journal->record(['setting:valid', $invalid]);
                $this->fail('Invalid key was accepted.');
            } catch (InvalidArgumentException) {
                $this->assertSame(0, DB::table('storefront_refresh_journal')->count());
            }
        }
        $keys = ['setting:'.str_repeat('x', 255), 'public-api:site-media:v1:hero_banner'];
        $this->assertSame($keys, $journal->find($journal->record($keys))->cache_keys);
        $this->assertSame([], $journal->find($journal->record([]))->cache_keys);
    }

    public function test_optional_initial_and_four_recoveries_preserve_backoff_and_exhaustion(): void
    {
        $this->freezeTime();
        $j = app(StorefrontRefreshJournal::class);
        $id = $j->record([]);
        $initial = $j->claim($id, true);
        $this->assertSame(0, $initial->recovery_attempts);
        $this->assertNull($j->claim($id));
        $this->assertFalse($j->finish($id, (string) Str::uuid(), true, 'success'));
        $this->assertTrue($j->finish($id, $initial->lease_token, false, 'not_configured'));
        $this->assertNull($j->claim($id, true));
        foreach ([30, 120, 300, null] as $index => $delay) {
            $lease = $j->claim($id);
            $this->assertSame($index + 1, $lease->recovery_attempts);
            $this->assertTrue($j->finish($id, $lease->lease_token, false, 'refresh_failed'));
            $this->assertNull($j->claim($id));
            if ($delay !== null) {
                $this->travel($delay)->seconds();
            }
        }
        $this->assertSame('exhausted', $j->find($id)->state);
        $this->travel(30)->days();
        $j->replay();
        $this->assertSame(4, $j->find($id)->recovery_attempts);
        Bus::assertNothingDispatched();
    }

    public function test_expired_lease_cannot_finish_and_replay_reclaims_with_consumed_budget(): void
    {
        $this->freezeTime();
        $j = app(StorefrontRefreshJournal::class);
        $id = $j->record(['setting:old']);
        $old = $j->claim($id);
        $this->travel(120)->seconds();
        $this->assertFalse($j->finish($id, $old->lease_token, true, 'success'));
        $this->assertSame(1, $j->replay());
        $this->assertSame('retry', $j->find($id)->state);
        $this->assertNull($j->claim($id));
        $this->travel(30)->seconds();
        $lease = $j->claim($id);
        $this->assertSame(2, $lease->recovery_attempts);
        $this->assertFalse($j->finish($id, $old->lease_token, true, 'success'));
        $this->assertTrue($j->finish($id, $lease->lease_token, true, 'success'));
        $this->assertNull($j->claim($id));
        $this->assertNull($j->find((string) Str::uuid()));
    }

    public function test_dispatch_throttles_and_queue_and_logger_failure_leave_recoverable_row(): void
    {
        $this->freezeTime();
        $j = app(StorefrontRefreshJournal::class);
        $id = $j->record(['setting:old', 'setting:new']);
        $bus = Bus::getFacadeRoot();
        Bus::shouldReceive('dispatch')->once()->andThrow(new RuntimeException('secret transport failure'));
        Log::shouldReceive('warning')->andThrow(new RuntimeException('logger failure'));
        $j->dispatch($id);
        $j->dispatch($id);
        $this->assertSame('enqueue_unavailable', $j->find($id)->last_status);
        $this->assertSame(0, $j->find($id)->recovery_attempts);
        Bus::swap($bus);
        $this->travel(30)->seconds();
        $this->assertSame(1, $j->replay());
        Bus::assertDispatched(PurgeCloudflareCache::class, fn ($job) => $job->journalId === $id && $job->cacheKeys === []);
        $this->assertSame('pending', $j->find($id)->state);
    }

    public function test_replay_limits_due_selection_and_completed_only_cleanup(): void
    {
        $this->freezeTime();
        $j = app(StorefrontRefreshJournal::class);
        $pending = $j->record([]);
        for ($i = 0; $i < 102; $i++) {
            $id = $j->record([]);
            $lease = $j->claim($id);
            $j->finish($id, $lease->lease_token, true, 'success');
        }
        $this->travel(8)->days();
        $recent = $j->record([]);
        $lease = $j->claim($recent);
        $j->finish($recent, $lease->lease_token, true, 'success');
        $j->record([]);
        $this->assertSame(0, $j->replay(100, 0));
        Bus::assertNothingDispatched();
        $this->assertSame(1, $j->replay(1));
        Bus::assertDispatchedTimes(PurgeCloudflareCache::class, 1);
        $this->assertSame(3, DB::table('storefront_refresh_journal')->where('state', 'completed')->count());
        $this->assertNotNull($j->find($pending));
        $this->assertNotNull($j->find($recent));
    }

    public function test_connection_uses_resolved_write_configuration_without_replica_or_persistent_pdo(): void
    {
        $original = config('database.connections.sqlite');
        config(['database.connections.sqlite' => array_merge($original, [
            'database' => $this->database.'.unusable',
            'write' => ['database' => $this->database, 'options' => [\PDO::ATTR_PERSISTENT => false]],
            'read' => ['database' => $this->database.'.replica', 'options' => [\PDO::ATTR_PERSISTENT => false]],
            'options' => [\PDO::ATTR_PERSISTENT => true],
        ])]);
        DB::purge('sqlite');
        $global = config('database.connections.sqlite');
        $j = app(StorefrontRefreshJournal::class);
        $id = $j->record([]);
        $alias = DB::connection($j::CONNECTION);
        $this->assertSame($this->database, $alias->getConfig('database'));
        $this->assertNull($alias->getConfig('read'));
        $this->assertNull($alias->getConfig('write'));
        $this->assertFalse($alias->getConfig('options')[\PDO::ATTR_PERSISTENT]);
        $this->assertSame($alias->getPdo(), $alias->getReadPdo());
        $this->assertSame($global, config('database.connections.sqlite'));
        $this->assertNotNull($j->find($id));
    }

    public function test_same_file_sqlite_writer_lock_is_recording_failure_not_false_durability(): void
    {
        $j = app(StorefrontRefreshJournal::class);
        $j->record([]);
        DB::connection($j::CONNECTION)->statement('PRAGMA busy_timeout = 1');
        DB::beginTransaction();
        DB::table('storefront_refresh_journal')->update(['last_status' => 'refresh_failed']);
        $id = (string) Str::uuid();
        try {
            $j->record(['setting:locked'], $id);
            $this->fail('Concurrent SQLite writer unexpectedly recorded.');
        } catch (\Illuminate\Database\QueryException) {
            $this->assertNull($j->find($id));
        } finally {
            DB::rollBack();
        }
        Bus::assertNothingDispatched();
    }

    public function test_crashed_initial_and_fourth_recovery_preserve_unknown_outcomes(): void
    {
        $this->freezeTime();
        $j = app(StorefrontRefreshJournal::class);
        $id = $j->record([]);
        $j->claim($id, true);
        $this->travel(120)->seconds();
        $j->replay();
        $this->assertSame(0, $j->find($id)->recovery_attempts);
        $this->assertSame('lease_expired', $j->find($id)->last_status);
        foreach ([30, 120, 300] as $delay) {
            $lease = $j->claim($id);
            $j->finish($id, $lease->lease_token, false, 'refresh_failed');
            $this->travel($delay)->seconds();
        }
        $j->claim($id);
        $this->travel(120)->seconds();
        $j->replay();
        $this->assertSame('exhausted', $j->find($id)->state);
        $this->assertNull($j->find($id)->completed_at);
        $this->assertSame(4, $j->find($id)->recovery_attempts);
        $this->assertNull($j->claim($id));
    }

    public function test_replay_stops_starting_submissions_after_elapsed_budget(): void
    {
        $j = app(StorefrontRefreshJournal::class);
        $j->record([]);
        $j->record([]);
        Bus::shouldReceive('dispatch')->once()->andReturnUsing(function () {
            usleep(1_100_000);
        });
        $this->assertSame(1, $j->replay(100, 1));
    }

    public function test_real_database_queue_rollback_loses_envelope_but_committed_content_and_journal_replay_survive(): void
    {
        $this->freezeTime();
        $queueFile = tempnam(storage_path('framework/testing'), 'journal-queue-');
        copy($this->database, $queueFile);
        config([
            'database.connections.journal_queue_test' => array_merge(config('database.connections.sqlite'), ['database' => $queueFile]),
            'database.connections.journal_reader_test' => config('database.connections.sqlite'),
            'queue.default' => 'database',
            'queue.connections.database.connection' => 'journal_queue_test',
            'queue.connections.database.after_commit' => false,
            'services.cloudflare.api_token' => 'test-only',
            'services.cloudflare.zone_id' => 'test-zone',
        ]);
        Bus::swap(Bus::getFacadeRoot()->dispatcher);
        $a = DB::connection('journal_queue_test');
        $b = DB::connection('sqlite');
        $reader = DB::connection('journal_reader_test');
        $j = app(StorefrontRefreshJournal::class);
        try {
            $a->beginTransaction();
            $b->beginTransaction();
            DB::table('settings')->insert(['key' => 'journal_committed', 'value' => 'final', 'created_at' => now(), 'updated_at' => now()]);
            $b->commit();
            $id = $j->record(['setting:journal_old', 'setting:journal_committed']);
            $this->assertNotSame($a->getPdo(), DB::connection($j::CONNECTION)->getPdo());
            $this->assertNotSame($b->getPdo(), DB::connection($j::CONNECTION)->getPdo());
            $j->dispatch($id);
            $this->assertSame(1, $a->table('jobs')->count());
            $a->rollBack();
            $this->assertSame(0, $a->table('jobs')->count());
            $this->assertSame('final', $reader->table('settings')->where('key', 'journal_committed')->value('value'));
            $this->assertSame($id, $reader->table('storefront_refresh_journal')->value('id'));
            unset($j);
            DB::purge(StorefrontRefreshJournal::CONNECTION);
            \Illuminate\Support\Facades\Cache::put('setting:journal_old', 'stale');
            \Illuminate\Support\Facades\Cache::put('setting:journal_committed', 'stale');
            Http::fake(function () use ($reader) {
                $this->assertFalse(\Illuminate\Support\Facades\Cache::has('setting:journal_old'));
                $this->assertFalse(\Illuminate\Support\Facades\Cache::has('setting:journal_committed'));
                $this->assertSame('final', $reader->table('settings')->where('key', 'journal_committed')->value('value'));
                return Http::response(['success' => true]);
            });
            $this->travel(30)->seconds();
            $j = app(StorefrontRefreshJournal::class);
            $this->assertSame(1, $j->replay());
            $this->assertSame(1, $a->table('jobs')->count());
            $this->artisan('queue:work', ['connection' => 'database', '--once' => true, '--force' => true])->assertExitCode(0);
            Http::assertSentCount(1);
            $this->assertSame(0, $a->table('jobs')->count());
            $this->assertSame('completed', $j->find($id)->state);
            $this->assertSame(1, $j->find($id)->recovery_attempts);
        } finally {
            if ($a->transactionLevel() > 0) {
                $a->rollBack();
            }
            DB::purge('journal_queue_test');
            DB::purge('journal_reader_test');
            unset($a, $reader);
            gc_collect_cycles();
            unlink($queueFile);
        }
    }

    public function test_replay_command_is_registered_and_bounded(): void
    {
        $j = app(StorefrontRefreshJournal::class);
        $id = $j->record([]);
        $this->artisan('storefront:refresh-replay', ['--limit' => 1, '--max-seconds' => 20])->assertExitCode(0);
        Bus::assertDispatched(PurgeCloudflareCache::class, fn ($job) => $job->journalId === $id);
    }

    public function test_inspection_model_decodes_metadata_without_writing(): void
    {
        $j = app(StorefrontRefreshJournal::class);
        $id = $j->record(['setting:test']);
        $entry = \App\Models\StorefrontRefreshJournalEntry::findOrFail($id);
        $this->assertSame(['setting:test'], $entry->cache_keys);
        $this->assertFalse($entry->initial_attempted);
        $this->assertSame(0, $entry->recovery_attempts);
    }

    public function test_unexpected_journal_transaction_is_rejected_without_committing_it(): void
    {
        $j = app(StorefrontRefreshJournal::class);
        $j->record([]);
        $connection = DB::connection($j::CONNECTION);
        $connection->beginTransaction();
        try {
            $j->record([]);
            $this->fail('Journal transaction was accepted.');
        } catch (RuntimeException) {
            $this->assertSame(1, $connection->transactionLevel());
        } finally {
            $connection->rollBack();
        }
    }
}
