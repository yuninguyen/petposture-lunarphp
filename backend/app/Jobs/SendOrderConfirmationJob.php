<?php

namespace App\Jobs;

use App\Mail\NewOrderAdmin;
use App\Mail\OrderConfirmation;
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

    public function __construct(
        public readonly int $orderId,
    ) {
        $this->afterCommit = true;
    }

    public function handle(): void
    {
        $order = Order::query()->with(['lines', 'shippingAddress', 'billingAddress', 'orderEvents'])->find($this->orderId);

        if (! $order || ! $order->customer_reference) {
            return;
        }

        Mail::send(new OrderConfirmation($order));

        $adminRecipient = config('mail.from.address');

        if ($adminRecipient) {
            Mail::to($adminRecipient)->send(new NewOrderAdmin($order));
        }
    }
}
