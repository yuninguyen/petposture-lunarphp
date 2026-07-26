<?php

namespace App\Jobs;

use App\Mail\PaymentFailureAlertAdmin;
use App\Support\MailConfigSync;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Mail;
use Lunar\Models\Order;

class SendPaymentFailureAlertJob implements ShouldQueue
{
    use Dispatchable;
    use InteractsWithQueue;
    use Queueable;
    use SerializesModels;

    public function __construct(
        public readonly int $orderId,
        public readonly int $failureCount,
        public readonly int $windowSeconds,
    ) {
        $this->afterCommit = true;
    }

    public function handle(): void
    {
        // The queue worker is a long-lived process (supervisord) — it never runs
        // RefreshMailConfig (HTTP middleware only), so admin SMTP-setting changes
        // wouldn't reach queued mail until worker restart without this.
        MailConfigSync::run();

        $order = Order::query()->with(['shippingAddress'])->find($this->orderId);

        if (! $order) {
            return;
        }

        $adminRecipient = config('mail.from.address');

        if ($adminRecipient) {
            Mail::to($adminRecipient)->send(new PaymentFailureAlertAdmin($order, $this->failureCount, $this->windowSeconds));
        }
    }
}
