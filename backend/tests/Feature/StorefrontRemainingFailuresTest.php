<?php

namespace Tests\Feature;

use App\Services\StorefrontCacheRefreshService;
use App\Services\StorefrontOriginFreshnessService;
use App\Services\StorefrontProjection;
use App\Services\StorefrontRevalidationService;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Tests\Fixtures\StorefrontHtml;
use Tests\TestCase;

class StorefrontRemainingFailuresTest extends TestCase
{
    public function test_legitimate_defaults_rendered_independently_can_match(): void
    {
        $settings = ['shop_name' => null, 'shop_logo' => '', 'description' => null, 'social' => null, 'contact' => null];
        $expected = StorefrontProjection::fromPublicData($settings, []);
        $html = str_replace('Committed description', 'Breed-focused pet product recommendations based on practical fit, materials, usability and everyday comfort.', StorefrontHtml::render('PetPosture'));
        $this->assertTrue((new StorefrontOriginFreshnessService)->matches($html, $expected));
    }

    public function test_eviction_failure_attempts_all_keys_but_never_reads_or_purges(): void
    {
        Http::fake();
        Cache::shouldReceive('forget')->once()->with('setting:first')->andThrow(new \RuntimeException('unavailable'));
        Cache::shouldReceive('forget')->once()->with('setting:second')->andReturn(true);
        $this->assertFalse(app(StorefrontCacheRefreshService::class)->refresh(['setting:first', 'setting:second'])->successful);
        Http::assertNothingSent();
    }

    public function test_missing_config_and_connection_timeout_never_purge(): void
    {
        Http::fake();
        config()->set('services.storefront', []);
        $this->assertFalse(app(StorefrontCacheRefreshService::class)->refresh([])->successful);
        Http::assertNothingSent();
        Http::swap(new \Illuminate\Http\Client\Factory);
        config()->set('services.storefront.backend_internal_url', 'http://127.0.0.1:8001');
        $calls = 0;
        Http::fake(function () use (&$calls) {
            $calls++;
            throw new ConnectionException('test timeout');
        });
        $this->assertFalse(app(StorefrontCacheRefreshService::class)->refresh([])->successful);
        $this->assertSame(1, $calls);
    }

    public function test_encoded_bodies_and_malformed_acknowledgements_are_not_accepted(): void
    {
        config()->set('services.storefront', ['internal_url' => 'http://127.0.0.1:3001', 'revalidation_secret' => 'test-secret']);
        foreach ([['revalidated' => false, 'scope' => 'homepage'], ['revalidated' => true, 'scope' => 'other'], ['revalidated' => true, 'scope' => 'homepage', 'extra' => true]] as $ack) {
            Http::swap(new \Illuminate\Http\Client\Factory);
            Http::fake(fn () => Http::response($ack));
            try {
                (new StorefrontRevalidationService)->invalidate(hrtime(true) / 1e9 + 30);
                $this->fail('Malformed acknowledgement accepted.');
            } catch (\RuntimeException) {
                $this->addToAssertionCount(1);
            }
        }
        Http::swap(new \Illuminate\Http\Client\Factory);
        Http::fake(fn () => Http::response('encoded', 200, ['Content-Type' => 'text/html', 'Content-Encoding' => 'gzip', 'Cache-Control' => 'public, s-maxage=300, stale-while-revalidate=86400']));
        $this->expectException(\RuntimeException::class);
        (new StorefrontRevalidationService)->homepage(hrtime(true) / 1e9 + 30);
    }
}
