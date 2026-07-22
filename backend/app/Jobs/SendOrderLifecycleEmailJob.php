<?php

namespace App\Jobs;

use App\Mail\CancelledOrderAdmin;
use App\Mail\OrderCancelled;
use App\Mail\OrderCreditProcessed;
use App\Mail\OrderDelivered;
use App\Mail\OrderReturned;
use App\Mail\OrderShipped;
use App\Support\MailConfigSync;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Mail;
use Lunar\Models\Order;

class SendOrderLifecycleEmailJob implements ShouldQueue
{
    use Dispatchable;
    use InteractsWithQueue;
    use Queueable;
    use SerializesModels;

    public function __construct(
        public readonly int $orderId,
        public readonly string $event,
    ) {
        $this->afterCommit = true;
    }

    public function handle(): void
    {
        // The queue worker is a long-lived process (supervisord) — it never runs
        // RefreshMailConfig (HTTP middleware only), so admin SMTP-setting changes
        // wouldn't reach queued mail until worker restart without this.
        MailConfigSync::run();

        $order = Order::query()->with(['lines', 'shippingAddress', 'billingAddress', 'orderEvents'])->find($this->orderId);

        if (! $order) {
            return;
        }

        match ($this->event) {
            'shipped' => $this->sendCustomer($order, new OrderShipped($order)),
            'delivered' => $this->sendCustomer($order, new OrderDelivered($order)),
            'cancelled' => $this->sendCancelled($order),
            'returned' => $this->sendCustomer($order, new OrderReturned($order)),
            'refunded' => $this->sendCustomer($order, new OrderCreditProcessed($order)),
            default => null,
        };
    }

    private function sendCustomer(Order $order, mixed $mailable): void
    {
        if (! $order->customer_reference) {
            return;
        }

        Mail::send($mailable);
    }

    private function sendCancelled(Order $order): void
    {
        if ($order->customer_reference) {
            Mail::send(new OrderCancelled($order));
        }

        $adminRecipient = config('mail.from.address');

        if ($adminRecipient) {
            Mail::to($adminRecipient)->send(new CancelledOrderAdmin($order));
        }
    }
}
