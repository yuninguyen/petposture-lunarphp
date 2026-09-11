<?php

namespace Tests\Feature;

use App\Http\Controllers\Api\SettingsController;
use App\Services\StorefrontOriginFreshnessService;
use App\Services\StorefrontProjection;
use App\Services\StorefrontRevalidationService;
use Illuminate\Http\Request;
use Illuminate\Routing\UrlGenerator;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\URL;
use Tests\Fixtures\StorefrontHtml;
use Tests\TestCase;

class StorefrontAssetParityTest extends TestCase
{
    public function test_relative_logo_uses_actual_ssr_authority_and_explicit_asset_root(): void
    {
        // Real controller + installed URL generator; cached public values avoid DB writes.
        foreach (['shop_name', 'shop_logo', 'shop_favicon', 'admin_logo', 'admin_favicon', 'shop_description',
            'default_currency', 'currency_symbol', 'social_facebook', 'social_instagram', 'social_twitter',
            'social_tiktok', 'social_pinterest', 'social_youtube', 'business_phone', 'business_address', 'google_analytics_id'] as $key) {
            Cache::put('setting:'.$key, ['exists' => true, 'value' => $key === 'shop_logo' ? 'logos/relative.svg' : null]);
        }
        $cases = [
            [null, 'https://127.0.0.1:8001/storage/logos/relative.svg'],
            ['https://api.petposture.com', 'https://api.petposture.com/storage/logos/relative.svg'],
        ];
        foreach ($cases as [$assetRoot, $wanted]) {
            $generator = new UrlGenerator(app('router')->getRoutes(), Request::create('http://127.0.0.1:8001/api/settings'), $assetRoot);
            $generator->forceScheme('https'); // Existing production provider behavior.
            URL::swap($generator);
            $data = (new SettingsController)->index()->getData(true)['data'];
            $this->assertSame($wanted, $data['shop_logo']);
        }
    }

    public function test_expected_read_never_overrides_ssr_internal_host_or_rewrites_logo(): void
    {
        config()->set('services.storefront.backend_internal_url', 'http://127.0.0.1:8001');
        $logo = 'https://127.0.0.1:8001/storage/logos/relative.svg';
        Http::preventStrayRequests();
        Http::fake(function ($request) use ($logo) {
            $this->assertSame(['127.0.0.1:8001'], $request->header('Host'));
            $this->assertFalse($request->hasHeader('Authorization'));
            $this->assertFalse($request->hasHeader('Cookie'));
            $settings = StorefrontHtml::settings();
            $settings['shop_logo'] = $logo;
            return Http::response(['status' => 'Request was successful.', 'data' => str_ends_with($request->url(), '/api/settings') ? $settings : []]);
        });
        $projection = (new StorefrontRevalidationService)->expected(hrtime(true) / 1e9 + 30);
        $this->assertSame($logo, $projection['organization']['logo']);
        Http::assertSentCount(2);
    }

    public function test_different_render_asset_authority_fails_even_when_path_is_identical(): void
    {
        $settings = StorefrontHtml::settings();
        $settings['shop_logo'] = 'https://127.0.0.1:8001/storage/logos/relative.svg';
        $expected = StorefrontProjection::fromPublicData($settings, []);
        $matching = str_replace('"description":"Committed description"}', '"description":"Committed description","logo":"https://127.0.0.1:8001/storage/logos/relative.svg"}', StorefrontHtml::render());
        $parser = new StorefrontOriginFreshnessService;
        $this->assertTrue($parser->matches($matching, $expected));
        $this->assertFalse($parser->matches(str_replace('https://127.0.0.1:8001/storage', 'https://api.petposture.com/storage', $matching), $expected));
    }
}
