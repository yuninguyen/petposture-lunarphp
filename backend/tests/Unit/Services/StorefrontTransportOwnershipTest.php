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
        Http::fake(fn () => Http::response('body', 200, ['Content-Type' => 'text/html', 'Cache-Control' => 'public, s-maxage=300', 'Set-Cookie' => '']));
        $this->expectException(\RuntimeException::class);
        (new StorefrontRevalidationService)->homepage(hrtime(true) / 1e9 + 30);
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
            Http::fake(fn () => \GuzzleHttp\Promise\Create::promiseFor(new Response($status, ['Content-Type' => 'text/html', 'Cache-Control' => 'public, s-maxage=300'], $body)));
            try {
                (new StorefrontRevalidationService)->homepage(hrtime(true) / 1e9 + 30);
                $this->fail('Unsafe response should fail.');
            } catch (\RuntimeException) {
                $this->assertTrue($closed, 'Response body must close before method returns on failure.');
            }
        }
    }
}
