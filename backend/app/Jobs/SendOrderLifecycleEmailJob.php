<?php

namespace App\Jobs;

use App\Mail\CancelledOrderAdmin;
use App\Mail\OrderCancelled;
use App\Mail\OrderCreditProcessed;
use App\Mail\OrderDelivered;
use App\Mail\OrderReturned;
use App\Mail\OrderShipped;
use App\Models\OrderShipment;
use App\Services\OrderEmailDeliveryService;
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

    public int $tries = 3;

    public function __construct(
        public readonly int $orderId,
        public readonly string $event,
        public readonly ?int $shipmentId = null,
        public readonly ?string $occurrenceKey = null,
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

        if (! $order) {
            return;
        }

        $shipment = $this->shipmentId
            ? OrderShipment::with('items')->find($this->shipmentId)
            : null;

        match ($this->event) {
            'shipped' => $this->sendCustomer($deliveries, $order, new OrderShipped($order, $shipment)),
            'delivered' => $this->sendCustomer($deliveries, $order, new OrderDelivered($order)),
            'cancelled' => $this->sendCancelled($deliveries, $order),
            'returned' => $this->sendCustomer($deliveries, $order, new OrderReturned($order)),
            'refunded' => $this->sendCustomer($deliveries, $order, new OrderCreditProcessed($order)),
            default => null,
        };
    }

    private function sendCustomer(OrderEmailDeliveryService $deliveries, Order $order, mixed $mailable): void
    {
        if (! $order->customer_reference) {
            return;
        }

        $deliveries->deliver(
            deliveryKey: $this->deliveryKey($order, 'customer'),
            jobType: "order_lifecycle.{$this->event}.customer",
            orderId: $order->id,
            recipient: (string) $order->customer_reference,
            send: fn () => Mail::send($mailable),
        );
    }

    private function sendCancelled(OrderEmailDeliveryService $deliveries, Order $order): void
    {
        if ($order->customer_reference) {
            $this->sendCustomer($deliveries, $order, new OrderCancelled($order));
        }

        $adminRecipient = config('mail.from.address');

        if ($adminRecipient) {
            $deliveries->deliver(
                deliveryKey: $this->deliveryKey($order, 'admin'),
                jobType: 'order_lifecycle.cancelled.admin',
                orderId: $order->id,
                recipient: $adminRecipient,
                send: fn () => Mail::to($adminRecipient)->send(new CancelledOrderAdmin($order)),
            );
        }
    }

    private function deliveryKey(Order $order, string $recipient): string
    {
        $occurrence = $this->occurrenceKey ?? ($this->shipmentId ? "shipment-{$this->shipmentId}" : 'default');

        return "order:{$order->id}:lifecycle:{$this->event}:occurrence:{$occurrence}:{$recipient}";
    }
}
