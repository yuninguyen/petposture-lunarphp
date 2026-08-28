<?php

namespace App\Jobs;

use App\Mail\NewOrderAdmin;
use App\Mail\OrderConfirmation;
use App\Services\OrderEmailDeliveryService;
use App\Support\MailConfigSync;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Mail;
use Lunar\Models\Order;

class SendOrderConfirmationJob implements ShouldQueue
{
    use Dispatchable;
    use InteractsWithQueue;
    use Queueable;
    use SerializesModels;

    public int $tries = 3;

    public function __construct(
        public readonly int $orderId,
    ) {
        $this->afterCommit = true;
    }

    public function backoff(): array
    {
        return [60, 300];
    }

    public function handle(OrderEmailDeliveryService $deliveries): void
    {
        // The queue worker is a long-lived process (supervisord) — it never runs
        // RefreshMailConfig (HTTP middleware only), so admin SMTP-setting changes
        // wouldn't reach queued mail until worker restart without this.
        MailConfigSync::run();

        $order = Order::query()->with(['lines', 'shippingAddress', 'billingAddress', 'orderEvents'])->find($this->orderId);

        if (! $order || ! $order->customer_reference) {
            return;
        }

        $deliveries->deliver(
            deliveryKey: "order:{$order->id}:confirmation:customer",
            jobType: 'order_confirmation.customer',
            orderId: $order->id,
            recipient: (string) $order->customer_reference,
            send: fn () => Mail::send(new OrderConfirmation($order)),
        );

        $adminRecipient = config('mail.from.address');

        if ($adminRecipient) {
            $deliveries->deliver(
                deliveryKey: "order:{$order->id}:confirmation:admin",
                jobType: 'order_confirmation.admin',
                orderId: $order->id,
                recipient: $adminRecipient,
                send: fn () => Mail::to($adminRecipient)->send(new NewOrderAdmin($order)),
            );
        }
    }
}
