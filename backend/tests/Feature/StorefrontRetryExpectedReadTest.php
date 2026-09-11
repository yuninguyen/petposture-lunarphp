<?php

namespace Tests\Feature;

use App\Services\StorefrontCacheRefreshService;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Tests\Fixtures\StorefrontHtml;
use Tests\TestCase;

class StorefrontRetryExpectedReadTest extends TestCase
{
    public function test_purge_failure_retry_rereads_new_expected_values_and_repeats_every_stage(): void
    {
        config()->set('services.storefront', ['internal_url' => 'http://127.0.0.1:3001',
            'backend_internal_url' => 'http://127.0.0.1:8001', 'revalidation_secret' => 'test-secret']);
        config()->set('services.cloudflare', ['api_token' => 'test-token', 'zone_id' => 'test-zone']);
        $name = 'B';
        $seen = [];
        Http::preventStrayRequests();
        Http::fake(function ($request) use (&$name, &$seen) {
            $seen[] = [$name, $request->method(), $request->url()];
            if (str_ends_with($request->url(), '/api/settings')) {
                $this->assertNull(Cache::get('setting:shop_name'));
                return Http::response(['status' => 'Request was successful.', 'data' => StorefrontHtml::settings($name)]);
            }
            if (str_contains($request->url(), '/api/site-media?')) {
                return Http::response(['status' => 'Request was successful.', 'data' => []]);
            }
            if (str_contains($request->url(), '/storefront-revalidate')) {
                return Http::response(['revalidated' => true, 'scope' => 'homepage']);
            }
            if ($request->url() === 'http://127.0.0.1:3001/') {
                return Http::response(StorefrontHtml::render($name), 200, ['Content-Type' => 'text/html', 'Cache-Control' => 'public, s-maxage=300, stale-while-revalidate=86400']);
            }
            return Http::response(['success' => $name === 'C'], $name === 'C' ? 200 : 503);
        });
        $service = app(StorefrontCacheRefreshService::class);
        Cache::put('setting:shop_name', 'A');
        $this->assertFalse($service->refresh(['setting:shop_name'])->successful);
        $name = 'C';
        Cache::put('setting:shop_name', 'B');
        $this->assertTrue($service->refresh(['setting:shop_name'])->successful);
        $this->assertCount(12, $seen);
        $this->assertSame(array_fill(0, 6, 'B'), array_column(array_slice($seen, 0, 6), 0));
        $this->assertSame(array_fill(0, 6, 'C'), array_column(array_slice($seen, 6), 0));
        $this->assertSame(array_column(array_slice($seen, 0, 6), 2), array_column(array_slice($seen, 6), 2));
    }
}
