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
use Mockery;
use RuntimeException;
use Tests\TestCase;

class CloudflarePurgeWarningMiddlewareTest extends TestCase
{
    private string $database;

    protected function setUp(): void
    {
        parent::setUp();
        $this->database = tempnam(storage_path('framework/testing'), 'journal-warning-');
        config(['database.connections.sqlite.database' => $this->database]);
        \Illuminate\Support\Facades\DB::purge('sqlite');
        // These service tests need only the journal schema, not content fixtures.
        (require database_path('migrations/2026_09_09_000001_create_storefront_refresh_journal_table.php'))->up();
        // Preserve the warning assertions while supplying the newly required origin barrier.
        config()->set('services.storefront', ['internal_url' => 'http://127.0.0.1:3001',
            'backend_internal_url' => 'http://127.0.0.1:8001', 'revalidation_secret' => 'test-secret']);
        \Illuminate\Support\Facades\Http::preventStrayRequests();
        \Illuminate\Support\Facades\Http::fake(function ($request) {
            return match ($request->url()) {
                'http://127.0.0.1:8001/api/settings' => \Illuminate\Support\Facades\Http::response(['status' => 'Request was successful.', 'data' => \Tests\Fixtures\StorefrontHtml::settings()]),
                'http://127.0.0.1:8001/api/site-media?collection=banner' => \Illuminate\Support\Facades\Http::response(['status' => 'Request was successful.', 'data' => []]),
                'http://127.0.0.1:3001/api/internal/storefront-revalidate' => \Illuminate\Support\Facades\Http::response(['revalidated' => true, 'scope' => 'homepage']),
                'http://127.0.0.1:3001/' => \Illuminate\Support\Facades\Http::response(\Tests\Fixtures\StorefrontHtml::render(), 200, ['Content-Type' => 'text/html', 'Cache-Control' => 'public, s-maxage=300, stale-while-revalidate=86400']),
                default => throw new RuntimeException('Unexpected test HTTP request.'),
            };
        });
    }

    protected function tearDown(): void
    {
        foreach (\Illuminate\Support\Facades\DB::getConnections() as $connection) {
            $connection->disconnect();
        }
        parent::tearDown();
        gc_collect_cycles();
        unlink($this->database);
    }

    public function test_first_failure_dispatches_retry_and_records_request_notice(): void
    {
        Bus::fake();
        Log::shouldReceive('warning')->once()->with(
            'Cloudflare cache purge pending retry.',
            Mockery::on(fn (array $context): bool => $context === ['status' => 500]),
        );
        $failure = new CloudflarePurgeResult(false, true, 500, 'Cloudflare cache purge failed.');
        $service = $this->mock(CloudflareCacheService::class);
        $service->shouldReceive('purgeAll')->once()->andReturn($failure);

        $result = app(PublicContentPurgeCoordinator::class)->purge();

        $this->assertFalse($result->successful);
        $this->assertSame($failure->status, $result->status);
        $this->assertTrue(app(CloudflarePurgeNotice::class)->isPending());
        Bus::assertDispatched(PurgeCloudflareCache::class);
    }

    public function test_first_failure_warning_log_does_not_leak_result_message(): void
    {
        Bus::fake();
        Log::shouldReceive('warning')->once()->with(
            'Cloudflare cache purge pending retry.',
            Mockery::on(fn (array $context): bool => $context === ['status' => 200]),
        );
        $service = $this->mock(CloudflareCacheService::class);
        $service->shouldReceive('purgeAll')->once()->andReturn(
            new CloudflarePurgeResult(false, true, 200, 'token=test-token body=secret exception=detail'),
        );

        app(PublicContentPurgeCoordinator::class)->purge();
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

        // Journal rollout intentionally replaces the old unconfigured no-op contract.
        $this->assertFalse($result->successful);
        $this->assertTrue(app(CloudflarePurgeNotice::class)->isPending());
        Bus::assertDispatched(PurgeCloudflareCache::class);
        $row = \Illuminate\Support\Facades\DB::table('storefront_refresh_journal')->first();
        $this->assertSame('retry', $row->state);
        $this->assertSame('not_configured', $row->last_status);
    }

    public function test_retry_job_uses_required_attempts_backoff_and_throws_on_failure(): void
    {
        $job = new PurgeCloudflareCache;
        $service = $this->mock(CloudflareCacheService::class);
        $service->shouldReceive('purgeAll')->once()->andReturn(new CloudflarePurgeResult(false, true, 500, 'Cloudflare cache purge failed.'));

        $this->assertSame(4, $job->tries);
        $this->assertSame([30, 120, 300], $job->backoff());
        $this->expectException(RuntimeException::class);
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

    public function test_retry_job_final_error_log_does_not_leak_exception_details(): void
    {
        Log::shouldReceive('error')->once()->with(
            'Cloudflare cache purge retry exhausted.',
            [],
        );
        $job = new PurgeCloudflareCache;

        $job->failed(new RuntimeException('token=test-token body=secret exception=detail'));
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
