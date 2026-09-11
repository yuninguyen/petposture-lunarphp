<?php
namespace Tests\Feature;
use Tests\TestCase;
class JournalReadinessEvidenceTest extends TestCase
{
    public function test_visibility_above_lease_passes_numeric_checks_but_not_activation(): void
    {
        config(['queue.default' => 'database', 'queue.connections.database.retry_after' => 180]);
        $this->artisan('storefront:refresh-readiness', ['--request-timeout' => 60, '--io-timeout' => 5])
            ->expectsOutput('Numeric checks passed: Cloudflare HTTP 5s < job 60s < queue visibility; job < lease 120s. Initial synchronous work is not governed by the job timeout.')
            ->assertExitCode(1);
    }

    public function test_numeric_bounds_alone_are_not_runtime_evidence(): void
    {
        config(['queue.default' => 'database', 'queue.connections.database.retry_after' => 90]);
        $this->artisan('storefront:refresh-readiness', ['--request-timeout' => 60, '--io-timeout' => 5])
            ->expectsOutput('Not ready: missing operator evidence for wall-clock request/replay hard stops, bounded DB/cache/queue IO, enforced worker timeout and graceful drain. Numeric configuration is not runtime proof.')
            ->assertExitCode(1);
    }
}
