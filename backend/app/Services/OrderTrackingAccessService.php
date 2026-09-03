<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Lunar\Models\Order;

class OrderTrackingAccessService
{
    public function issue(Order $order): string
    {
        $token = Str::random(64);
        $expiresAt = now()->addDays(90);

        DB::table('order_tracking_tokens')->insert([
            'order_id' => $order->id,
            'token_hash' => hash('sha256', $token),
            'expires_at' => $expiresAt,
            'created_at' => now(),
        ]);

        $order->setAttribute('tracking_access_token_expires_at', $expiresAt);
        $order->setAttribute('tracking_access_token', $token);

        return $token;
    }

    public function find(string $token, string $email): ?Order
    {
        if (trim($token) === '' || trim($email) === '') {
            return null;
        }

        $orderId = DB::table('order_tracking_tokens')
            ->where('token_hash', hash('sha256', $token))
            ->where('expires_at', '>', now())
            ->value('order_id');

        if (! $orderId) {
            return null;
        }

        return Order::query()
            ->whereKey($orderId)
            ->whereRaw('LOWER(customer_reference) = ?', [Str::lower(trim($email))])
            ->with(['shippingAddress', 'billingAddress', 'lines'])
            ->first();
    }
}
