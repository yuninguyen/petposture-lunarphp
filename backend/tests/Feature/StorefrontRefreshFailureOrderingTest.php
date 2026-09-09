<?php

namespace Tests\Feature;

use App\Services\StorefrontCacheRefreshService;
use Illuminate\Support\Facades\Http;
use Tests\Fixtures\StorefrontHtml;
use Tests\TestCase;

class StorefrontRefreshFailureOrderingTest extends TestCase
{
    public function test_each_http_boundary_failure_suppresses_every_later_stage(): void
    {
        config()->set('services.storefront', ['internal_url' => 'http://127.0.0.1:3001',
            'backend_internal_url' => 'http://127.0.0.1:8001', 'revalidation_secret' => 'test-secret']);
        config()->set('services.cloudflare', ['api_token' => 'test-token', 'zone_id' => 'test-zone']);
        foreach ([1, 2, 3, 4, 5, 6] as $failure) {
            Http::swap(new \Illuminate\Http\Client\Factory);
            Http::preventStrayRequests();
            $calls = 0;
            Http::fake(function ($request) use (&$calls, $failure) {
                $calls++;
                if ($calls === $failure) {
                    return Http::response(['error' => 'not accepted'], 503);
                }
                return match ($calls) {
                    1 => Http::response(['status' => 'Request was successful.', 'data' => StorefrontHtml::settings()]),
                    2 => Http::response(['status' => 'Request was successful.', 'data' => []]),
                    3 => Http::response(['revalidated' => true, 'scope' => 'homepage']),
                    4, 5 => Http::response(StorefrontHtml::render(), 200, ['Content-Type' => 'text/html', 'Cache-Control' => 'public, s-maxage=300']),
                    default => Http::response(['success' => true]),
                };
            });
            $this->assertFalse(app(StorefrontCacheRefreshService::class)->refresh([])->successful);
            $this->assertSame($failure, $calls);
        }
    }

    public function test_malformed_successful_expected_read_never_posts_invalidation(): void
    {
        config()->set('services.storefront.backend_internal_url', 'http://127.0.0.1:8001');
        Http::fakeSequence()->push(['data' => null])->push(['status' => 'Request was successful.', 'data' => []]);
        $this->assertFalse(app(StorefrontCacheRefreshService::class)->refresh([])->successful);
        Http::assertSentCount(1);
        Http::assertNotSent(fn ($request) => $request->method() === 'POST');
    }
}
