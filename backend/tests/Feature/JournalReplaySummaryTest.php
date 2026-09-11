<?php

namespace Tests\Feature;

use App\Services\StorefrontRefreshJournal;
use Illuminate\Support\Facades\Bus;
use Illuminate\Support\Facades\DB;
use RuntimeException;
use Tests\TestCase;

class JournalReplaySummaryTest extends TestCase
{
    private string $database;

    protected function setUp(): void
    {
        parent::setUp();
        $this->database = tempnam(storage_path('framework/testing'), 'journal-summary-');
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

    public function test_summary_separates_selected_submitted_deferred_and_failed_and_resets(): void
    {
        $journal = app(StorefrontRefreshJournal::class);
        $first = $journal->record([]);
        $second = $journal->record([]);
        $third = $journal->record([]);
        $calls = 0;
        Bus::shouldReceive('dispatch')->andReturnUsing(function () use (&$calls, $third) {
            $calls++;
            if ($calls === 1) {
                // Another replay owner wins the later row after selection.
                DB::table('storefront_refresh_journal')->where('id', $third)->update(['next_dispatch_at' => now()->addMinutes(5)]);
                return null;
            }
            throw new RuntimeException('transport failed');
        });
        DB::table('storefront_refresh_journal')->where('id', $first)->update(['updated_at' => now()->subSeconds(3)]);
        DB::table('storefront_refresh_journal')->where('id', $second)->update(['updated_at' => now()->subSeconds(2)]);
        $journal->replay();
        $this->assertSame(['selected' => 3, 'submitted' => 1, 'deferred' => 1, 'failed' => 1], $journal->replaySummary());
        $journal->replay();
        $this->assertSame(['selected' => 0, 'submitted' => 0, 'deferred' => 0, 'failed' => 0], $journal->replaySummary());
    }

    public function test_command_prints_sanitized_counts_and_nonzero_degradation(): void
    {
        app(StorefrontRefreshJournal::class)->record([]);
        Bus::shouldReceive('dispatch')->andThrow(new RuntimeException('secret'));
        $this->artisan('storefront:refresh-replay')
            ->expectsOutput('Selected 1; submitted 0; deferred 0; failed 1. Submission is not refresh completion.')
            ->assertExitCode(1);
    }
}
