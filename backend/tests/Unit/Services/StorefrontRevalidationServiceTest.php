<?php

namespace Tests\Unit\Services;

use App\Services\StorefrontRevalidationService;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class StorefrontRevalidationServiceTest extends TestCase
{
    public function test_fixed_post_has_secret_but_canonical_get_does_not(): void
    {
        config()->set('services.storefront.internal_url', 'http://127.0.0.1:3001');
        config()->set('services.storefront.revalidation_secret', 'test-only-secret');
        $requests = [];
        Http::fake(function ($request, $options) use (&$requests) {
            $requests[] = [$request, $options];
            return Http::response($request->method() === 'POST' ? ['revalidated' => true, 'scope' => 'homepage'] : '<!DOCTYPE html><html><body></body></html>', 200,
                ['Content-Type' => $request->method() === 'POST' ? 'application/json' : 'text/html', 'Cache-Control' => 'public, max-age=0, s-maxage=300']);
        });
        $service = new StorefrontRevalidationService;
        $deadline = hrtime(true) / 1e9 + 30;
        $service->invalidate($deadline);
        $service->homepage($deadline);
        $this->assertCount(2, $requests);
        $this->assertSame('http://127.0.0.1:3001/api/internal/storefront-revalidate', $requests[0][0]->url());
        $this->assertSame(['Bearer test-only-secret'], $requests[0][0]->header('Authorization'));
        $this->assertSame(['scope' => 'homepage'], $requests[0][0]->data());
        $this->assertSame('http://127.0.0.1:3001/', $requests[1][0]->url());
        $this->assertSame(['petposture.com'], $requests[1][0]->header('Host'));
        $this->assertSame(['text/html'], $requests[1][0]->header('Accept'));
        $this->assertFalse($requests[1][0]->hasHeader('Authorization'));
        $this->assertFalse($requests[1][0]->hasHeader('Cookie'));
        foreach ($requests as [, $options]) {
            $this->assertFalse($options['allow_redirects']);
            $this->assertLessThanOrEqual(10, $options['timeout']);
            $this->assertLessThanOrEqual(3, $options['connect_timeout']);
        }
    }

    public function test_public_target_and_expired_deadline_fail_before_network(): void
    {
        Http::fake();
        config()->set('services.storefront.internal_url', 'https://petposture.com');
        try {
            (new StorefrontRevalidationService)->homepage(hrtime(true) / 1e9 + 30);
            $this->fail('Public edge must not be used.');
        } catch (\RuntimeException) {
            Http::assertNothingSent();
        }
        config()->set('services.storefront.internal_url', 'http://127.0.0.1:3001');
        try {
            (new StorefrontRevalidationService)->homepage(hrtime(true) / 1e9 - 1);
            $this->fail('Expired deadline must not send.');
        } catch (\RuntimeException) {
            Http::assertNothingSent();
        }
    }

    public function test_redirect_cookie_private_nonhtml_and_oversized_responses_fail_closed(): void
    {
        config()->set('services.storefront.internal_url', 'http://127.0.0.1:3001');
        foreach ([[302, ['Location' => 'https://petposture.com']], [200, ['Set-Cookie' => 'x=1']],
            [200, ['Cache-Control' => 'private']], [200, ['Content-Type' => 'application/json']],
            [200, ['Content-Length' => '2097153']]] as [$status, $headers]) {
            Http::swap(new \Illuminate\Http\Client\Factory);
            Http::fake(fn () => Http::response('body', $status, $headers + ['Content-Type' => 'text/html', 'Cache-Control' => 'public, s-maxage=300']));
            try {
                (new StorefrontRevalidationService)->homepage(hrtime(true) / 1e9 + 30);
                $this->fail('Unsafe response must fail.');
            } catch (\RuntimeException) {
                $this->addToAssertionCount(1);
            }
        }
    }
}
