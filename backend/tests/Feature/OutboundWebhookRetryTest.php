<?php

namespace Tests\Feature;

use App\Jobs\DispatchOutboundWebhook;
use App\Models\Setting;
use Illuminate\Contracts\Queue\Job as QueueJob;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;
use Mockery;
use Tests\TestCase;

class OutboundWebhookRetryTest extends TestCase
{
    use RefreshDatabase;

    public function test_server_error_throws_for_queue_retry_without_marking_job_failed(): void
    {
        Setting::set('outbound_webhook_url', 'https://hooks.example.test/orders');
        Http::fake(['hooks.example.test/*' => Http::response('unavailable', 503)]);
        $job = new DispatchOutboundWebhook('order.updated', ['order_id' => 42]);
        $queueJob = Mockery::mock(QueueJob::class);
        $queueJob->shouldNotReceive('fail');
        $job->setJob($queueJob);
        $exception = null;

        try {
            $job->handle();
        } catch (\RuntimeException $caught) {
            $exception = $caught;
        }

        $this->assertNotNull($exception, 'A 5xx response must bubble for queue retry.');
        Http::assertSentCount(1);
    }

    public function test_network_error_bubbles_for_queue_retry_without_dead_lettering(): void
    {
        Setting::set('outbound_webhook_url', 'https://hooks.example.test/orders');
        Http::fake(['hooks.example.test/*' => Http::failedConnection('Connection refused')]);
        $job = new DispatchOutboundWebhook('order.updated', ['order_id' => 42]);
        $queueJob = Mockery::mock(QueueJob::class);
        $queueJob->shouldNotReceive('fail');
        $job->setJob($queueJob);

        $this->expectException(ConnectionException::class);
        $job->handle();
    }

    public function test_client_error_is_dead_lettered_without_throwing_for_retry(): void
    {
        Setting::set('outbound_webhook_url', 'https://hooks.example.test/orders');
        Http::fake(['hooks.example.test/*' => Http::response('invalid payload', 422)]);
        $job = new DispatchOutboundWebhook('order.updated', ['order_id' => 42]);
        $queueJob = Mockery::mock(QueueJob::class);
        $queueJob->shouldReceive('fail')->once()->with(Mockery::type(\RuntimeException::class));
        $job->setJob($queueJob);

        $job->handle();

        Http::assertSentCount(1);
    }
}
