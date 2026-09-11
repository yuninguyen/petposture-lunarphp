<?php

namespace Tests\Unit\Services;

use App\Services\StorefrontCacheRefreshService;
use Illuminate\Support\Facades\Http;
use Tests\Fixtures\StorefrontHttp;
use Tests\TestCase;

class StorefrontHttpObservabilityTest extends TestCase
{
    public function test_unexpected_url_survives_refresh_catch_and_fixture_reinstallation(): void
    {
        StorefrontHttp::fake();
        config()->set('services.storefront.backend_internal_url', 'http://127.0.0.1:8002');
        app(StorefrontCacheRefreshService::class)->refresh([]);
        StorefrontHttp::fake();
        $this->expectException(\PHPUnit\Framework\AssertionFailedError::class);
        $this->expectExceptionMessage('GET http://127.0.0.1:8002/api/settings');
        StorefrontHttp::assertNoUnexpectedRequests();
    }

    public function test_unexpected_method_survives_caught_dispatch_exception(): void
    {
        StorefrontHttp::fake();
        try {
            Http::post('http://127.0.0.1:8001/api/settings');
        } catch (\Throwable) {
        }
        $this->expectException(\PHPUnit\Framework\AssertionFailedError::class);
        $this->expectExceptionMessage('POST http://127.0.0.1:8001/api/settings');
        StorefrontHttp::assertNoUnexpectedRequests();
    }
}
