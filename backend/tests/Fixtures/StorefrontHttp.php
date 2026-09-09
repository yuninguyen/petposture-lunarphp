<?php

namespace Tests\Fixtures;

use Illuminate\Support\Facades\Http;

final class StorefrontHttp
{
    public static function configure(): void
    {
        config()->set('services.storefront', ['internal_url' => 'http://127.0.0.1:3001',
            'backend_internal_url' => 'http://127.0.0.1:8001', 'revalidation_secret' => 'test-secret']);
    }

    public static function response($request)
    {
        return match ($request->url()) {
            'http://127.0.0.1:8001/api/settings' => Http::response(['status' => 'Request was successful.', 'data' => StorefrontHtml::settings()]),
            'http://127.0.0.1:8001/api/site-media?collection=banner' => Http::response(['status' => 'Request was successful.', 'data' => []]),
            'http://127.0.0.1:3001/api/internal/storefront-revalidate' => Http::response(['revalidated' => true, 'scope' => 'homepage']),
            'http://127.0.0.1:3001/' => Http::response(StorefrontHtml::render(), 200, ['Content-Type' => 'text/html', 'Cache-Control' => 'public, s-maxage=300']),
            default => null,
        };
    }
}
