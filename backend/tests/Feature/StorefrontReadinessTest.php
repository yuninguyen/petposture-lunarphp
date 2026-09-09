<?php

namespace Tests\Feature;

use Tests\TestCase;

class StorefrontReadinessTest extends TestCase
{
    public function test_missing_hard_timeout_evidence_fails_readiness(): void
    {
        config(['queue.default' => 'database']);
        $this->artisan('storefront:refresh-readiness')->assertExitCode(1);
    }

    public function test_incompatible_visibility_or_sync_transport_fails_readiness(): void
    {
        config(['queue.default' => 'database', 'queue.connections.database.retry_after' => 50]);
        $this->artisan('storefront:refresh-readiness', ['--request-timeout' => 60, '--io-timeout' => 5])->assertExitCode(1);
        config(['queue.default' => 'sync']);
        $this->artisan('storefront:refresh-readiness', ['--request-timeout' => 60, '--io-timeout' => 5])->assertExitCode(1);
    }

    public function test_compatible_async_settings_and_declared_hard_timeouts_pass_readiness(): void
    {
        config(['queue.default' => 'database', 'queue.connections.database.retry_after' => 90]);
        $this->artisan('storefront:refresh-readiness', ['--request-timeout' => 60, '--io-timeout' => 5])->assertExitCode(1);
        $this->artisan('storefront:refresh-readiness', ['--request-timeout' => 120, '--io-timeout' => 5])->assertExitCode(1);
    }
}
