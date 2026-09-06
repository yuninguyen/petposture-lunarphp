<?php

namespace Tests\Feature;

use App\Http\Middleware\AttachCloudflarePurgeWarning;
use App\Jobs\PurgeCloudflareCache;
use App\Services\CloudflareCacheService;
use App\Services\PublicContentPurgeCoordinator;
use App\Support\CloudflarePurgeNotice;
use App\ValueObjects\CloudflarePurgeResult;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Bus;
use Illuminate\Support\Facades\Log;
use Tests\TestCase;

class CloudflarePurgeWarningMiddlewareTest extends TestCase
{
    public function test_first_failure_dispatches_retry_and_records_request_notice(): void
    {
        Bus::fake();
        Log::spy();
        $failure = new CloudflarePurgeResult(false, true, 500, 'Cloudflare cache purge failed.');
        $service = $this->mock(CloudflareCacheService::class);
        $service->shouldReceive('purgeAll')->once()->andReturn($failure);

        $result = app(PublicContentPurgeCoordinator::class)->purge();

        $this->assertSame($failure, $result);
        $this->assertTrue(app(CloudflarePurgeNotice::class)->isPending());
        Bus::assertDispatched(PurgeCloudflareCache::class);
    }

    public function test_repeated_calls_in_one_request_are_deduplicated(): void
    {
        Bus::fake();
        $service = $this->mock(CloudflareCacheService::class);
        $service->shouldReceive('purgeAll')->once()->andReturn(new CloudflarePurgeResult(false, true, 500, 'Cloudflare cache purge failed.'));

        app(PublicContentPurgeCoordinator::class)->purge();
        app(PublicContentPurgeCoordinator::class)->purge();

        Bus::assertDispatchedTimes(PurgeCloudflareCache::class, 1);
    }

    public function test_successful_call_does_not_dispatch_retry_or_warning(): void
    {
        Bus::fake();
        $service = $this->mock(CloudflareCacheService::class);
        $service->shouldReceive('purgeAll')->once()->andReturn(new CloudflarePurgeResult(true, true, 200));

        $result = app(PublicContentPurgeCoordinator::class)->purge();

        $this->assertTrue($result->successful);
        $this->assertFalse(app(CloudflarePurgeNotice::class)->isPending());
        Bus::assertNothingDispatched();
    }

    public function test_unconfigured_call_remains_a_no_op_without_retry_or_warning(): void
    {
        Bus::fake();
        $service = $this->mock(CloudflareCacheService::class);
        $service->shouldReceive('purgeAll')->once()->andReturn(new CloudflarePurgeResult(true, false));

        $result = app(PublicContentPurgeCoordinator::class)->purge();

        $this->assertTrue($result->successful);
        $this->assertFalse($result->configured);
        $this->assertFalse(app(CloudflarePurgeNotice::class)->isPending());
        Bus::assertNothingDispatched();
    }

    public function test_retry_job_uses_required_attempts_backoff_and_throws_on_failure(): void
    {
        $job = new PurgeCloudflareCache;
        $service = $this->mock(CloudflareCacheService::class);
        $service->shouldReceive('purgeAll')->once()->andReturn(new CloudflarePurgeResult(false, true, 500, 'Cloudflare cache purge failed.'));

        $this->assertSame(4, $job->tries);
        $this->assertSame([30, 120, 300], $job->backoff());
        $this->expectException(\RuntimeException::class);
        $this->expectExceptionMessage('Cloudflare cache purge failed.');

        $job->handle($service);
    }

    public function test_retry_job_completes_when_purge_succeeds(): void
    {
        $job = new PurgeCloudflareCache;
        $service = $this->mock(CloudflareCacheService::class);
        $service->shouldReceive('purgeAll')->once()->andReturn(new CloudflarePurgeResult(true, true, 200));

        $job->handle($service);

        $this->addToAssertionCount(1);
    }

    public function test_warning_is_added_only_to_successful_admin_api_response_when_notice_is_present(): void
    {
        app(CloudflarePurgeNotice::class)->markPending();
        $middleware = app(AttachCloudflarePurgeWarning::class);
        $request = Request::create('/api/admin/pages', 'POST');

        $response = $middleware->handle($request, fn () => new Response('saved', 200));

        $this->assertSame('saved', $response->getContent());
        $this->assertSame('purge-pending', $response->headers->get('X-PetPosture-Cache-Warning'));
    }

    public function test_non_admin_or_unsuccessful_responses_are_not_marked(): void
    {
        app(CloudflarePurgeNotice::class)->markPending();
        $middleware = app(AttachCloudflarePurgeWarning::class);

        $public = $middleware->handle(Request::create('/api/pages', 'POST'), fn () => new Response('ok', 200));
        $failed = $middleware->handle(Request::create('/api/admin/pages', 'POST'), fn () => new Response('failed', 422));

        $this->assertNull($public->headers->get('X-PetPosture-Cache-Warning'));
        $this->assertNull($failed->headers->get('X-PetPosture-Cache-Warning'));
    }
}
