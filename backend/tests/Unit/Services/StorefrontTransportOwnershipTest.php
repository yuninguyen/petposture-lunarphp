<?php

namespace Tests\Unit\Services;

use App\Services\StorefrontRevalidationService;
use GuzzleHttp\Psr7\FnStream;
use GuzzleHttp\Psr7\Response;
use GuzzleHttp\Psr7\Utils;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class StorefrontTransportOwnershipTest extends TestCase
{
    public function test_empty_set_cookie_header_is_rejected_by_presence(): void
    {
        config()->set('services.storefront.internal_url', 'http://127.0.0.1:3001');
        Http::fake(fn () => Http::response('body', 200, ['Content-Type' => 'text/html', 'Cache-Control' => 'public, s-maxage=300, stale-while-revalidate=86400', 'Set-Cookie' => '']));
        $this->expectException(\RuntimeException::class);
        (new StorefrontRevalidationService)->homepage(hrtime(true) / 1e9 + 30);
    }

    public function test_distinct_returned_body_closes_after_rejected_sink_write(): void
    {
        config()->set('services.storefront.internal_url', 'http://127.0.0.1:3001');
        $closed = false;
        $written = null;
        $stream = Utils::streamFor('retained body');
        $body = FnStream::decorate($stream, [
            'close' => function () use (&$closed, $stream) { $closed = true; $stream->close(); },
        ]);
        Http::fake(function ($request, $options) use ($body, &$written) {
            $written = $options['sink']->write(str_repeat('x', 2097153));
            return \GuzzleHttp\Promise\Create::promiseFor(new Response(200, [], $body));
        });
        try {
            (new StorefrontRevalidationService)->homepage(hrtime(true) / 1e9 + 30);
            $this->fail('Expected rejected sink write.');
        } catch (\RuntimeException $error) {
            $this->assertSame('Storefront body budget exceeded.', $error->getMessage());
        }
        $this->assertSame(0, $written);
        $this->assertTrue($closed, 'Retained distinct body must close before the budget exception escapes.');
    }

    public function test_distinct_response_body_is_closed_on_status_and_read_failure(): void
    {
        config()->set('services.storefront.internal_url', 'http://127.0.0.1:3001');
        foreach ([503, 200] as $status) {
            Http::swap(new \Illuminate\Http\Client\Factory);
            $closed = false;
            $stream = Utils::streamFor('body');
            $body = FnStream::decorate($stream, [
                'close' => function () use (&$closed, $stream) { $closed = true; $stream->close(); },
                'read' => function () { throw new \RuntimeException('Distinct read failed.'); },
            ]);
            Http::fake(fn () => \GuzzleHttp\Promise\Create::promiseFor(new Response($status, ['Content-Type' => 'text/html', 'Cache-Control' => 'public, s-maxage=300, stale-while-revalidate=86400'], $body)));
            try {
                (new StorefrontRevalidationService)->homepage(hrtime(true) / 1e9 + 30);
                $this->fail('Unsafe response should fail.');
            } catch (\RuntimeException) {
                $this->assertTrue($closed, 'Response body must close before method returns on failure.');
            }
        }
    }
}
