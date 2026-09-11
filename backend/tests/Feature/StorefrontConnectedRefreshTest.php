<?php

namespace Tests\Feature;

use App\Jobs\PurgeCloudflareCache;
use App\Services\CloudflareCacheService;
use App\Services\StorefrontCacheRefreshService;
use App\Services\StorefrontRefreshJournal;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Tests\Fixtures\StorefrontHtml;
use Tests\TestCase;

class StorefrontConnectedRefreshTest extends TestCase
{
    private array $calls = [];

    private array $homepageCacheControl = [];

    private function transport(array $pages, bool $purgeFails = false, string $policy = 'public, s-maxage=300, stale-while-revalidate=86400'): void
    {
        config()->set('services.storefront', ['internal_url' => 'http://127.0.0.1:3001',
            'backend_internal_url' => 'http://127.0.0.1:8001', 'revalidation_secret' => 'test-secret']);
        config()->set('services.cloudflare', ['api_token' => 'test-token', 'zone_id' => 'test-zone']);
        Http::swap(new \Illuminate\Http\Client\Factory);
        Http::preventStrayRequests();
        Http::fake(function ($request) use (&$pages, $purgeFails, $policy) {
            $this->calls[] = $request->method().' '.$request->url();
            if ($request->url() === 'http://127.0.0.1:3001/') {
                $this->homepageCacheControl[] = $request->header('Cache-Control');
            }
            if (str_ends_with($request->url(), '/api/settings')) {
                $this->assertNull(Cache::get('setting:shop_name'));
                return Http::response(['status' => 'Request was successful.', 'data' => StorefrontHtml::settings()]);
            }
            if (str_contains($request->url(), '/api/site-media?collection=banner')) {
                return Http::response(['status' => 'Request was successful.', 'data' => []]);
            }
            if (str_contains($request->url(), '/storefront-revalidate')) {
                return Http::response(['revalidated' => true, 'scope' => 'homepage']);
            }
            if ($request->url() === 'http://127.0.0.1:3001/') {
                return Http::response(array_shift($pages) ?? StorefrontHtml::render('A'), 200,
                    ['Content-Type' => 'text/html', 'Cache-Control' => $policy]);
            }
            return Http::response(['success' => ! $purgeFails], $purgeFails ? 503 : 200);
        });
    }

    public function test_success_requires_two_ordinary_matching_reads_before_purge(): void
    {
        $this->transport([StorefrontHtml::render(), StorefrontHtml::render()]);
        Cache::put('setting:shop_name', 'A');
        $this->assertTrue(app(StorefrontCacheRefreshService::class)->refresh(['setting:shop_name'])->successful);
        $this->assertSame(['GET http://127.0.0.1:8001/api/settings', 'GET http://127.0.0.1:8001/api/site-media?collection=banner',
            'POST http://127.0.0.1:3001/api/internal/storefront-revalidate', 'GET http://127.0.0.1:3001/',
            'GET http://127.0.0.1:3001/', 'POST https://api.cloudflare.com/client/v4/zones/test-zone/purge_cache'], $this->calls);
        $this->assertSame([['no-cache'], []], $this->homepageCacheControl);
    }

    public function test_invalid_homepage_cache_policy_prevents_purge(): void
    {
        $this->transport([StorefrontHtml::render()], policy: 'public, s-maxage=300');

        $this->assertFalse(app(StorefrontCacheRefreshService::class)->refresh([])->successful);
        $this->assertSame([['no-cache']], $this->homepageCacheControl);
        $this->assertCount(0, Http::recorded(fn ($request) => str_contains($request->url(), '/purge_cache')));
    }

    public function test_accepted_invalidation_stale_first_or_second_read_never_purges(): void
    {
        foreach ([[StorefrontHtml::render('A')], [StorefrontHtml::render(), StorefrontHtml::render('A')]] as $pages) {
            $this->calls = [];
            $this->transport($pages);
            $this->assertFalse(app(StorefrontCacheRefreshService::class)->refresh([])->successful);
            $this->assertCount(count($pages) + 3, $this->calls);
        }
    }

    public function test_legacy_serialized_envelope_executes_full_chain_not_edge_only(): void
    {
        $this->transport([StorefrontHtml::render(), StorefrontHtml::render()]);
        Cache::put('setting:shop_name', 'A');
        $job = unserialize(serialize(new PurgeCloudflareCache(['setting:shop_name'])));
        $job->handle(app(CloudflareCacheService::class));
        $this->assertCount(6, $this->calls);
        $this->assertSame('GET http://127.0.0.1:8001/api/settings', $this->calls[0]);
    }
}
