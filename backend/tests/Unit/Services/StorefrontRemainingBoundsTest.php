<?php

namespace Tests\Unit\Services;

use App\Services\StorefrontRevalidationService;
use Illuminate\Support\Facades\Http;
use RuntimeException;
use Tests\TestCase;

class StorefrontRemainingBoundsTest extends TestCase
{
    public function test_incomplete_declared_body_is_not_accepted_as_complete_html(): void
    {
        config()->set('services.storefront.internal_url', 'http://127.0.0.1:3001');
        Http::fake(fn () => Http::response('<html></html>', 200, ['Content-Type' => 'text/html', 'Content-Length' => '100', 'Cache-Control' => 'public, s-maxage=300, stale-while-revalidate=86400']));
        $this->expectException(RuntimeException::class);
        (new StorefrontRevalidationService)->homepage(hrtime(true) / 1e9 + 30);
    }

    public function test_invalid_settings_shape_stops_before_banner_request(): void
    {
        config()->set('services.storefront.backend_internal_url', 'http://127.0.0.1:8001');
        Http::fake(fn () => Http::response(['status' => 'Request was successful.', 'data' => ['shop_name' => ['invalid']]]));
        try {
            (new StorefrontRevalidationService)->expected(hrtime(true) / 1e9 + 30);
            $this->fail('Invalid settings must fail.');
        } catch (\InvalidArgumentException) {
            Http::assertSentCount(1);
        }
    }

    public function test_remaining_budget_caps_request_and_connection_timeouts(): void
    {
        config()->set('services.storefront.internal_url', 'http://127.0.0.1:3001');
        Http::fake(function ($request, $options) {
            $this->assertGreaterThan(0, $options['timeout']);
            $this->assertLessThanOrEqual(0.5, $options['timeout']);
            $this->assertSame($options['timeout'], $options['connect_timeout']);
            return Http::response('body', 200, ['Content-Type' => 'text/html', 'Cache-Control' => 'public, s-maxage=300, stale-while-revalidate=86400']);
        });
        $this->assertSame('body', (new StorefrontRevalidationService)->homepage(hrtime(true) / 1e9 + 0.5));
    }
}
