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

    public static function fake(?callable $purge = null): void
    {
        self::configure();
        Http::swap(new \Illuminate\Http\Client\Factory);
        Http::preventStrayRequests();
        Http::fake(function ($request) use ($purge) {
            if (self::isPurge($request)) {
                return $purge ? $purge($request) : Http::response(['success' => true]);
            }
            return self::response($request) ?? throw new \RuntimeException('Unexpected fixture HTTP endpoint.');
        });
    }

    public static function isPurge($request): bool
    {
        return $request->method() === 'POST'
            && $request->url() === 'https://api.cloudflare.com/client/v4/zones/test-zone/purge_cache';
    }

    public static function assertPurgeCount(int $count): void
    {
        \PHPUnit\Framework\Assert::assertCount($count, Http::recorded(fn ($request) => self::isPurge($request)));
    }

    public static function response($request)
    {
        $post = $request->url() === 'http://127.0.0.1:3001/api/internal/storefront-revalidate';
        if ($request->method() !== ($post ? 'POST' : 'GET')) {
            return null;
        }
        return match ($request->url()) {
            'http://127.0.0.1:8001/api/settings' => Http::response(['status' => 'Request was successful.', 'data' => StorefrontHtml::settings()]),
            'http://127.0.0.1:8001/api/site-media?collection=banner' => Http::response(['status' => 'Request was successful.', 'data' => []]),
            'http://127.0.0.1:3001/api/internal/storefront-revalidate' => Http::response(['revalidated' => true, 'scope' => 'homepage']),
            'http://127.0.0.1:3001/' => Http::response(StorefrontHtml::render(), 200, ['Content-Type' => 'text/html', 'Cache-Control' => 'public, s-maxage=300']),
            default => null,
        };
    }
}
