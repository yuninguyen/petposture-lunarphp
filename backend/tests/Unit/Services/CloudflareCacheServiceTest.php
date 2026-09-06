<?php

namespace Tests\Unit\Services;

use App\Services\CloudflareCacheService;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class CloudflareCacheServiceTest extends TestCase
{
    public function test_configured_successful_purge_returns_successful_result(): void
    {
        config()->set('services.cloudflare.api_token', 'test-token');
        config()->set('services.cloudflare.zone_id', 'test-zone');
        Http::fake([
            'api.cloudflare.com/*' => Http::response(['success' => true], 200),
        ]);

        $result = app(CloudflareCacheService::class)->purgeAll();

        $this->assertTrue($result->successful);
        $this->assertTrue($result->configured);
        $this->assertSame(200, $result->status);
        $this->assertNull($result->message);
        Http::assertSent(function (Request $request): bool {
            return $request->url() === 'https://api.cloudflare.com/client/v4/zones/test-zone/purge_cache'
                && $request['purge_everything'] === true;
        });
    }

    public function test_http_failure_returns_status_and_safe_message(): void
    {
        config()->set('services.cloudflare.api_token', 'test-token');
        config()->set('services.cloudflare.zone_id', 'test-zone');
        Http::fake([
            'api.cloudflare.com/*' => Http::response(['errors' => [['message' => 'secret response body']]], 500),
        ]);

        $result = app(CloudflareCacheService::class)->purgeAll();

        $this->assertFalse($result->successful);
        $this->assertTrue($result->configured);
        $this->assertSame(500, $result->status);
        $this->assertSame('Cloudflare cache purge failed.', $result->message);
        $this->assertStringNotContainsString('secret', $result->message);
    }

    public function test_exception_returns_failure_without_throwing(): void
    {
        config()->set('services.cloudflare.api_token', 'test-token');
        config()->set('services.cloudflare.zone_id', 'test-zone');
        Http::fake(function (): never {
            throw new \RuntimeException('token=test-token');
        });

        $result = app(CloudflareCacheService::class)->purgeAll();

        $this->assertFalse($result->successful);
        $this->assertTrue($result->configured);
        $this->assertNull($result->status);
        $this->assertSame('Cloudflare cache purge unavailable.', $result->message);
        $this->assertStringNotContainsString('test-token', $result->message);
    }

    public function test_unconfigured_service_returns_no_op_result_without_http_request(): void
    {
        config()->set('services.cloudflare.api_token', null);
        config()->set('services.cloudflare.zone_id', null);
        Http::fake();

        $result = app(CloudflareCacheService::class)->purgeAll();

        $this->assertTrue($result->successful);
        $this->assertFalse($result->configured);
        $this->assertNull($result->status);
        $this->assertNull($result->message);
        Http::assertNothingSent();
    }
}
