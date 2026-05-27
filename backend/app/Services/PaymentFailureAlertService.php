<?php

namespace App\Services;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Lunar\Models\Order;

class PaymentFailureAlertService
{
    private const int WINDOW_SECONDS = 3600;

    private const int DEFAULT_THRESHOLD = 3;

    public function record(Order $order): void
    {
        $threshold = (int) (config('commerce.payment.failure_alert_threshold') ?: self::DEFAULT_THRESHOLD);

        $key   = "payment:failures:order:{$order->id}";
        $count = (int) Cache::get($key, 0) + 1;

        Cache::put($key, $count, self::WINDOW_SECONDS);

        if ($count === $threshold) {
            Log::critical('Payment failure threshold reached', [
                'order_id'       => $order->id,
                'order_reference'=> $order->reference,
                'customer_email' => $order->customer_reference,
                'failure_count'  => $count,
                'window_seconds' => self::WINDOW_SECONDS,
            ]);

            app(OrderEventService::class)->record(
                $order,
                'payment.failure_alert',
                'Payment failure alert',
                "Payment has failed {$count} time(s) within the last hour. Manual review required."
            );
        }
    }

    public function reset(Order $order): void
    {
        Cache::forget("payment:failures:order:{$order->id}");
    }
}
