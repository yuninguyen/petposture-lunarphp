<?php

namespace Tests\Unit\Services;

use App\Services\StorefrontRevalidationService;
use Illuminate\Support\Facades\Http;
use RuntimeException;
use Tests\TestCase;

class StorefrontBodyBoundsTest extends TestCase
{
    public function test_transport_sink_rejects_chunk_before_over_limit_write(): void
    {
        config()->set('services.storefront.internal_url', 'http://127.0.0.1:3001');
        $written = 0;
        Http::fake(function ($request, $options) use (&$written) {
            $sink = $options['sink'];
            $written += $sink->write(str_repeat('a', 2097152));
            $this->assertSame(0, $sink->write('x'));
            return Http::response('unused');
        });
        try {
            (new StorefrontRevalidationService)->homepage(hrtime(true) / 1e9 + 30);
            $this->fail('Expected body bound failure.');
        } catch (RuntimeException) {
            $this->assertSame(2097152, $written);
        }
    }

    public function test_transport_sink_checks_monotonic_deadline_during_consumption(): void
    {
        config()->set('services.storefront.internal_url', 'http://127.0.0.1:3001');
        $deadline = hrtime(true) / 1e9 + 0.05;
        $entered = false;
        Http::fake(function ($request, $options) use ($deadline, &$entered) {
            $entered = true;
            // Test-only elapsed-time simulation; production has no sleeps or polling.
            usleep(60000);
            $this->assertGreaterThan($deadline, hrtime(true) / 1e9);
            $this->assertSame(0, $options['sink']->write('late'));
            return Http::response('unused');
        });
        try {
            (new StorefrontRevalidationService)->homepage($deadline);
            $this->fail('Expected deadline failure.');
        } catch (RuntimeException) {
            $this->assertTrue($entered);
        }
    }

    public function test_body_without_content_length_is_bounded_and_not_accepted_after_buffering(): void
    {
        config()->set('services.storefront.internal_url', 'http://127.0.0.1:3001');
        Http::fake(fn () => Http::response(str_repeat('a', 2097153), 200,
            ['Content-Type' => 'text/html', 'Cache-Control' => 'public, s-maxage=300, stale-while-revalidate=86400']));
        $this->expectException(RuntimeException::class);
        (new StorefrontRevalidationService)->homepage(hrtime(true) / 1e9 + 30);
    }
}
