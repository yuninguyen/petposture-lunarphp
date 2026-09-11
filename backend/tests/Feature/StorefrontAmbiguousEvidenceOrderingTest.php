<?php
namespace Tests\Feature;

use App\Services\StorefrontCacheRefreshService;
use Illuminate\Support\Facades\Http;
use Tests\Fixtures\StorefrontHtml;
use Tests\Fixtures\StorefrontHttp;
use Tests\TestCase;

class StorefrontAmbiguousEvidenceOrderingTest extends TestCase
{
    public function test_empty_cookie_and_duplicate_json_fail_first_or_second_get_before_purge(): void
    {
        foreach (['cookie', 'json'] as $fault) {
            foreach ([1, 2] as $badRead) {
                StorefrontHttp::configure();
                config()->set('services.cloudflare', ['api_token' => 'test-only', 'zone_id' => 'test-zone']);
                Http::swap(new \Illuminate\Http\Client\Factory);
                Http::preventStrayRequests();
                $reads = 0;
                $purges = 0;
                Http::fake(function ($request) use ($fault, $badRead, &$reads, &$purges) {
                    if (StorefrontHttp::isPurge($request)) {
                        $purges++;
                        return Http::response(['success' => true]);
                    }
                    if ($request->url() === 'http://127.0.0.1:3001/') {
                        $reads++;
                        $html = StorefrontHtml::render();
                        $headers = ['Content-Type' => 'text/html', 'Cache-Control' => 'public, s-maxage=300, stale-while-revalidate=86400'];
                        if ($reads === $badRead) {
                            if ($fault === 'cookie') $headers['Set-Cookie'] = '';
                            else $html = str_replace('"name":"B"', '"name":"old","name":"B"', $html);
                        }
                        return Http::response($html, 200, $headers);
                    }
                    return StorefrontHttp::response($request);
                });
                $this->assertFalse(app(StorefrontCacheRefreshService::class)->refresh([])->successful);
                $this->assertSame($badRead, $reads);
                $this->assertSame(0, $purges);
            }
        }
    }
}
