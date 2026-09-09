<?php
namespace Tests\Feature;
use Tests\TestCase;
class JournalReadinessEvidenceTest extends TestCase
{
    public function test_numeric_bounds_alone_are_not_runtime_evidence(): void
    {
        config(['queue.default' => 'database', 'queue.connections.database.retry_after' => 90]);
        $this->artisan('storefront:refresh-readiness', ['--request-timeout' => 60, '--io-timeout' => 5])
            ->expectsOutput('Not ready: missing operator evidence for wall-clock request/replay hard stops, bounded DB/cache/queue IO, enforced worker timeout and graceful drain. Numeric configuration is not runtime proof.')
            ->assertExitCode(1);
    }
}
