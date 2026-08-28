<?php

namespace Tests\Unit;

use App\Providers\AppServiceProvider;
use App\Support\ProductionMailConfiguration;
use Illuminate\Config\Repository;
use Illuminate\Foundation\Application;
use PHPUnit\Framework\TestCase;

class ProductionMailConfigurationTest extends TestCase
{
    public function test_production_log_mailer_fails_loudly(): void
    {
        $app = $this->application('production', 'log');

        $this->expectException(\RuntimeException::class);
        $this->expectExceptionMessage('Production cannot use the log mailer');
        ProductionMailConfiguration::assertSafe($app);
    }

    public function test_application_provider_enforces_the_guard_during_boot(): void
    {
        $app = $this->application('production', 'log');

        $this->expectException(\RuntimeException::class);
        (new AppServiceProvider($app))->boot();
    }

    public function test_production_real_mailer_and_non_production_log_mailer_are_allowed(): void
    {
        ProductionMailConfiguration::assertSafe($this->application('production', 'smtp'));
        ProductionMailConfiguration::assertSafe($this->application('local', 'log'));

        $this->addToAssertionCount(2);
    }

    private function application(string $environment, string $mailer): Application
    {
        $app = new Application;
        $app->detectEnvironment(fn () => $environment);
        $app->instance('config', new Repository([
            'mail' => ['default' => $mailer],
        ]));

        return $app;
    }
}
