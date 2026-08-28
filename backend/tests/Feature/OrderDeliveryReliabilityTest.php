<?php

namespace Tests\Feature;

use App\Jobs\SendOrderConfirmationJob;
use App\Jobs\SendOrderLifecycleEmailJob;
use App\Mail\NewOrderAdmin;
use App\Mail\OrderConfirmation;
use App\Mail\OrderCreditProcessed;
use App\Mail\OrderDelivered;
use App\Models\OrderEmailDelivery;
use App\Services\OrderEmailDeliveryService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Lunar\Models\Order;
use Symfony\Component\Mailer\Envelope;
use Symfony\Component\Mailer\SentMessage;
use Symfony\Component\Mime\Email;
use Tests\TestCase;

class OrderDeliveryReliabilityTest extends TestCase
{
    use RefreshDatabase;

    public function test_order_email_jobs_retry_provider_failures_with_backoff(): void
    {
        $confirmation = new SendOrderConfirmationJob(1);
        $lifecycle = new SendOrderLifecycleEmailJob(1, 'delivered');

        $this->assertSame(3, $confirmation->tries);
        $this->assertSame([60, 300], $confirmation->backoff());
        $this->assertSame(3, $lifecycle->tries);
        $this->assertSame([60, 300], $lifecycle->backoff());
    }

    public function test_rerunning_confirmation_job_does_not_resend_customer_or_admin_mail(): void
    {
        Mail::fake();
        config(['mail.from.address' => 'admin@petposture.test']);
        $order = Order::factory()->create([
            'customer_reference' => 'customer@example.com',
            'status' => 'payment-received',
        ]);
        $job = new SendOrderConfirmationJob($order->id);
        $deliveries = app(OrderEmailDeliveryService::class);

        $job->handle($deliveries);
        $job->handle($deliveries);

        Mail::assertSent(OrderConfirmation::class, 1);
        Mail::assertSent(NewOrderAdmin::class, 1);
        $this->assertDatabaseHas('order_email_deliveries', [
            'delivery_key' => "order:{$order->id}:confirmation:customer",
            'job_type' => 'order_confirmation.customer',
            'recipient' => 'customer@example.com',
            'status' => OrderEmailDelivery::STATUS_SENT,
            'attempt_count' => 1,
        ]);
        $this->assertDatabaseHas('order_email_deliveries', [
            'delivery_key' => "order:{$order->id}:confirmation:admin",
            'status' => OrderEmailDelivery::STATUS_SENT,
            'attempt_count' => 1,
        ]);
    }

    public function test_failed_recipient_retries_without_repeating_completed_recipient(): void
    {
        $deliveries = app(OrderEmailDeliveryService::class);
        $customerSends = 0;
        $adminSends = 0;

        $deliveries->deliver('order:99:test:customer', 'test.customer', 99, 'customer@example.com', function () use (&$customerSends) {
            $customerSends++;

            return null;
        });

        try {
            $deliveries->deliver('order:99:test:admin', 'test.admin', 99, 'admin@example.com', function () use (&$adminSends) {
                $adminSends++;
                throw new \RuntimeException('Provider unavailable');
            });
        } catch (\RuntimeException) {
        }

        $deliveries->deliver('order:99:test:customer', 'test.customer', 99, 'customer@example.com', function () use (&$customerSends) {
            $customerSends++;

            return null;
        });
        $deliveries->deliver('order:99:test:admin', 'test.admin', 99, 'admin@example.com', function () use (&$adminSends) {
            $adminSends++;

            return null;
        });

        $this->assertSame(1, $customerSends);
        $this->assertSame(2, $adminSends);
        $this->assertDatabaseHas('order_email_deliveries', [
            'delivery_key' => 'order:99:test:customer',
            'status' => OrderEmailDelivery::STATUS_SENT,
            'attempt_count' => 1,
        ]);
        $this->assertDatabaseHas('order_email_deliveries', [
            'delivery_key' => 'order:99:test:admin',
            'status' => OrderEmailDelivery::STATUS_SENT,
            'attempt_count' => 2,
        ]);
    }

    public function test_provider_message_id_is_recorded_after_success(): void
    {
        $email = (new Email)
            ->from('sender@example.com')
            ->to('customer@example.com')
            ->text('Delivered');
        $sentMessage = new SentMessage($email, Envelope::create($email));
        $sentMessage->setMessageId('provider-message-123');

        app(OrderEmailDeliveryService::class)->deliver(
            'order:99:provider:customer',
            'test.provider',
            99,
            'customer@example.com',
            fn () => $sentMessage,
        );

        $this->assertDatabaseHas('order_email_deliveries', [
            'delivery_key' => 'order:99:provider:customer',
            'provider_message_id' => 'provider-message-123',
            'status' => OrderEmailDelivery::STATUS_SENT,
        ]);
    }

    public function test_abandoned_sending_claim_is_not_blindly_resent_after_worker_crash(): void
    {
        OrderEmailDelivery::query()->create([
            'delivery_key' => 'order:99:crash:customer',
            'job_type' => 'test.crash',
            'order_id' => 99,
            'recipient' => 'customer@example.com',
            'status' => OrderEmailDelivery::STATUS_SENDING,
            'attempt_count' => 1,
            'sending_at' => now(),
        ]);
        $sends = 0;

        $sent = app(OrderEmailDeliveryService::class)->deliver(
            'order:99:crash:customer',
            'test.crash',
            99,
            'customer@example.com',
            function () use (&$sends) {
                $sends++;

                return null;
            },
        );

        $this->assertFalse($sent);
        $this->assertSame(0, $sends);
        $this->assertDatabaseHas('order_email_deliveries', [
            'delivery_key' => 'order:99:crash:customer',
            'status' => OrderEmailDelivery::STATUS_SENDING,
            'attempt_count' => 1,
        ]);
    }

    public function test_distinct_refund_occurrences_each_send_once(): void
    {
        Mail::fake();
        $order = Order::factory()->create([
            'customer_reference' => 'customer@example.com',
            'status' => 'payment-received',
        ]);
        $firstRefund = new SendOrderLifecycleEmailJob($order->id, 'refunded', null, 'refund-a');
        $secondRefund = new SendOrderLifecycleEmailJob($order->id, 'refunded', null, 'refund-b');
        $deliveries = app(OrderEmailDeliveryService::class);

        $firstRefund->handle($deliveries);
        $firstRefund->handle($deliveries);
        $secondRefund->handle($deliveries);

        Mail::assertSent(OrderCreditProcessed::class, 2);
    }

    public function test_rerunning_lifecycle_job_sends_one_email_per_event_key(): void
    {
        Mail::fake();
        $order = Order::factory()->create([
            'customer_reference' => 'customer@example.com',
            'status' => 'delivered',
        ]);
        $job = new SendOrderLifecycleEmailJob($order->id, 'delivered');
        $deliveries = app(OrderEmailDeliveryService::class);

        $job->handle($deliveries);
        $job->handle($deliveries);

        Mail::assertSent(OrderDelivered::class, 1);
        $this->assertDatabaseHas('order_email_deliveries', [
            'delivery_key' => "order:{$order->id}:lifecycle:delivered:occurrence:default:customer",
            'status' => OrderEmailDelivery::STATUS_SENT,
            'attempt_count' => 1,
        ]);
    }
}
