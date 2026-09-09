<?php

namespace Tests\Feature;

use App\Services\StorefrontRefreshJournal;
use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Support\Facades\Bus;
use Illuminate\Support\Facades\DB;
use RuntimeException;
use Tests\TestCase;

class StorefrontReplayOperationsTest extends TestCase
{
    private string $database;

    protected function setUp(): void
    {
        parent::setUp();
        $this->database = tempnam(storage_path('framework/testing'), 'replay-ops-');
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

    public function test_replay_is_registered_every_minute_in_existing_scheduler(): void
    {
        $event = collect(app(Schedule::class)->events())->first(fn ($event) => str_contains($event->command ?? '', 'storefront:refresh-replay'));
        $this->assertNotNull($event);
        $this->assertSame('* * * * *', $event->expression);
        $this->assertStringContainsString('--limit=100 --max-seconds=20', $event->command);
        $id = app(StorefrontRefreshJournal::class)->record(['setting:scheduled']);
        Bus::fake();
        $this->artisan('storefront:refresh-replay', ['--limit' => 100, '--max-seconds' => 20])->assertExitCode(0);
        Bus::assertDispatched(\App\Jobs\PurgeCloudflareCache::class, fn ($job) => $job->journalId === $id);
    }

    public function test_competing_claim_after_selection_is_harmless_command_contention(): void
    {
        $journal = app(StorefrontRefreshJournal::class);
        app()->instance(StorefrontRefreshJournal::class, $journal);
        $id = $journal->record(['setting:contended']);
        $claimed = null;
        $interleaved = false;
        DB::connection(StorefrontRefreshJournal::CONNECTION)->listen(function ($query) use ($journal, $id, &$claimed, &$interleaved) {
            if (! $interleaved && str_starts_with(strtolower($query->sql), 'select')
                && str_contains(strtolower($query->sql), 'order by')) {
                $interleaved = true;
                $claimed = $journal->claim($id);
            }
        });
        Bus::fake();
        $this->artisan('storefront:refresh-replay')->assertExitCode(0);
        $this->assertTrue($interleaved);
        $this->assertNotNull($claimed);
        $this->assertSame('leased', $journal->find($id)->state);
        $this->assertSame($claimed->lease_token, $journal->find($id)->lease_token);
        $this->assertSame(0, $journal->replayDispatchFailures());
        $this->assertSame(['selected' => 1, 'submitted' => 0, 'deferred' => 1, 'failed' => 0], $journal->replaySummary());
        Bus::assertNothingDispatched();
    }

    public function test_dispatch_failure_makes_command_fail_without_destroying_recovery(): void
    {
        $journal = app(StorefrontRefreshJournal::class);
        app()->instance(StorefrontRefreshJournal::class, $journal);
        $id = $journal->record(['setting:ops']);
        Bus::shouldReceive('dispatch')->once()->andThrow(new RuntimeException('secret queue error'));
        \Illuminate\Support\Facades\Log::shouldReceive('warning')->once()->andThrow(new RuntimeException('secret logger error'));
        $this->artisan('storefront:refresh-replay')
            ->expectsOutput('Storefront refresh replay degraded: submission unavailable; journal retained for later replay.')
            ->assertExitCode(1);
        $this->assertSame(1, $journal->replayDispatchFailures());
        Bus::fake();
        $this->artisan('storefront:refresh-replay')->assertExitCode(0);
        $this->assertSame($journal, app(StorefrontRefreshJournal::class));
        $this->assertSame(0, $journal->replayDispatchFailures());
        Bus::assertNothingDispatched();
        $this->assertSame('pending', app(StorefrontRefreshJournal::class)->find($id)->state);
        $this->assertSame(0, app(StorefrontRefreshJournal::class)->find($id)->recovery_attempts);
    }
}
