<?php

namespace Tests\Feature;

use App\Services\StorefrontRevalidationService;
use Tests\TestCase;

class StorefrontNativeCurlTest extends TestCase
{
    public function test_real_curl_aborts_oversize_and_stall_then_remains_usable(): void
    {
        if (getenv('C2_LOOPBACK_TRANSPORT') !== '1') {
            $this->markTestSkipped('Requires owned test fixture on literal loopback port47839.');
        }
        $this->assertTrue(extension_loaded('curl'));
        config()->set('services.storefront.internal_url', 'http://127.0.0.1:47839');
        // No Http::fake: installed Laravel -> synchronous Guzzle -> native curl.
        foreach ([['oversize', 3.0], ['stall', 0.3]] as [$case, $budget]) {
            $started = hrtime(true) / 1e9;
            try {
                (new StorefrontRevalidationService)->homepage($started + $budget);
                $this->fail($case.' response must fail before server EOF.');
            } catch (\RuntimeException|\Illuminate\Http\Client\ConnectionException $error) {
                $elapsed = hrtime(true) / 1e9 - $started;
                $this->assertLessThan($case === 'oversize' ? 2.0 : 1.5, $elapsed);
                if ($case === 'oversize') {
                    $this->assertSame('Storefront body budget exceeded.', $error->getMessage());
                } else {
                    $this->assertInstanceOf(\Illuminate\Http\Client\ConnectionException::class, $error);
                    $cause = $error->getPrevious();
                    $this->assertInstanceOf(\GuzzleHttp\Exception\ConnectException::class, $cause);
                    $this->assertSame(28, $cause->getHandlerContext()['errno'] ?? null);
                }
                fwrite(STDOUT, sprintf("NATIVE_CURL_%s_ELAPSED=%.6f\n", strtoupper($case), $elapsed));
            }
        }
        $this->assertSame('complete', (new StorefrontRevalidationService)->homepage(hrtime(true) / 1e9 + 3));
    }
}
