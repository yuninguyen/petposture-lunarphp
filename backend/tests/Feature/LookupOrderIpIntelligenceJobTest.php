<?php

namespace Tests\Feature;

use App\Jobs\LookupOrderIpIntelligenceJob;
use App\Services\IpIntelligenceService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;
use Lunar\Models\Order;
use Tests\TestCase;

class LookupOrderIpIntelligenceJobTest extends TestCase
{
    use RefreshDatabase;

    private const IP = '14.231.20.30';

    private function fakeIpApi(): void
    {
        Http::fake([
            'http://ip-api.com/*' => Http::response([
                'status' => 'success', 'country' => 'Vietnam', 'regionName' => 'Hanoi', 'city' => 'Hanoi',
                'isp' => 'VNPT', 'org' => 'VNPT Group', 'mobile' => false, 'proxy' => false, 'hosting' => false,
            ]),
        ]);
    }

    private function runJob(Order $order, int $attempt = 1): void
    {
        (new LookupOrderIpIntelligenceJob($order->id, self::IP, $attempt))->handle(app(IpIntelligenceService::class));
    }

    public function test_it_adds_the_location_fields_without_dropping_other_meta_and_checks_again_later(): void
    {
        Queue::fake();
        $this->fakeIpApi();
        $order = Order::factory()->create(['meta' => ['customer_ip' => self::IP, 'payment_status' => 'paid']]);

        $this->runJob($order);

        $meta = $order->fresh()->meta;
        $this->assertSame('Hanoi, Hanoi, Vietnam', $meta['customer_ip_location']);
        $this->assertSame('VNPT', $meta['customer_ip_isp']);
        $this->assertSame('Residential / Business', $meta['customer_ip_service_type']);
        $this->assertSame('paid', $meta['payment_status']);
        Queue::assertPushed(LookupOrderIpIntelligenceJob::class, fn ($job) => $job->attempt === 2 && $job->orderId === $order->id);
    }

    public function test_the_second_pass_restores_fields_a_concurrent_webhook_write_wiped(): void
    {
        Queue::fake();
        $this->fakeIpApi();
        $order = Order::factory()->create(['meta' => ['customer_ip' => self::IP]]);

        $this->runJob($order);
        // The payment webhook saved its older copy of the meta over the lookup's write.
        $order->update(['meta' => ['customer_ip' => self::IP, 'payment_status' => 'paid']]);

        $this->runJob($order, 2);

        $meta = $order->fresh()->meta;
        $this->assertSame('Hanoi, Hanoi, Vietnam', $meta['customer_ip_location']);
        $this->assertSame('paid', $meta['payment_status']);
        Queue::assertPushed(LookupOrderIpIntelligenceJob::class, 1);
    }

    public function test_an_already_enriched_order_is_left_alone_without_calling_the_lookup(): void
    {
        Queue::fake();
        Http::fake();
        $order = Order::factory()->create(['meta' => ['customer_ip' => self::IP, 'customer_ip_location' => 'Hanoi, Hanoi, Vietnam']]);

        $this->runJob($order, 2);

        Http::assertNothingSent();
        Queue::assertNothingPushed();
    }
}
