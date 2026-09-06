<?php

namespace Tests\Unit\Services;

use App\Services\CloudflareCacheService;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use RuntimeException;
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

    public function test_purge_request_uses_a_five_second_timeout(): void
    {
        config()->set('services.cloudflare.api_token', 'test-token');
        config()->set('services.cloudflare.zone_id', 'test-zone');
        $timeout = null;
        Http::fake(function (Request $request, array $options) use (&$timeout) {
            $timeout = $options['timeout'] ?? null;

            return Http::response(['success' => true], 200);
        });

        app(CloudflareCacheService::class)->purgeAll();

        $this->assertSame(5, $timeout);
    }

    public function test_http_success_with_unsuccessful_cloudflare_envelope_returns_failure(): void
    {
        config()->set('services.cloudflare.api_token', 'test-token');
        config()->set('services.cloudflare.zone_id', 'test-zone');
        Http::fake([
            'api.cloudflare.com/*' => Http::response([
                'success' => false,
                'errors' => [['message' => 'secret response body']],
            ], 200),
        ]);

        $result = app(CloudflareCacheService::class)->purgeAll();

        $this->assertFalse($result->successful);
        $this->assertTrue($result->configured);
        $this->assertSame(200, $result->status);
        $this->assertSame('Cloudflare cache purge failed.', $result->message);
        $this->assertStringNotContainsString('secret', $result->message);
    }

    public function test_http_success_requires_cloudflare_success_to_be_strictly_true(): void
    {
        config()->set('services.cloudflare.api_token', 'test-token');
        config()->set('services.cloudflare.zone_id', 'test-zone');
        Http::fake([
            'api.cloudflare.com/*' => Http::response(['success' => 1], 200),
        ]);

        $result = app(CloudflareCacheService::class)->purgeAll();

        $this->assertFalse($result->successful);
        $this->assertSame(200, $result->status);
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

    public function test_connection_exception_returns_failure_without_throwing(): void
    {
        config()->set('services.cloudflare.api_token', 'test-token');
        config()->set('services.cloudflare.zone_id', 'test-zone');
        Http::fake([
            'api.cloudflare.com/*' => Http::failedConnection('token=test-token'),
        ]);

        $result = app(CloudflareCacheService::class)->purgeAll();

        $this->assertFalse($result->successful);
        $this->assertTrue($result->configured);
        $this->assertNull($result->status);
        $this->assertSame('Cloudflare cache purge unavailable.', $result->message);
        $this->assertStringNotContainsString('test-token', $result->message);
    }

    public function test_timeout_exception_returns_failure_without_throwing(): void
    {
        config()->set('services.cloudflare.api_token', 'test-token');
        config()->set('services.cloudflare.zone_id', 'test-zone');
        Http::fake(function (): never {
            throw new RuntimeException('cURL error 28: timeout token=test-token');
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
