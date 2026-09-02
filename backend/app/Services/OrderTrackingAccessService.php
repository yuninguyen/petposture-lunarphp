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

        DB::table('lunar_orders')
            ->where('id', $order->id)
            ->update([
                'tracking_access_token_hash' => hash('sha256', $token),
                'tracking_access_token_expires_at' => $expiresAt,
                'updated_at' => now(),
            ]);

        $order->setAttribute('tracking_access_token_hash', hash('sha256', $token));
        $order->setAttribute('tracking_access_token_expires_at', $expiresAt);
        $order->setAttribute('tracking_access_token', $token);

        return $token;
    }

    public function find(string $token, string $email): ?Order
    {
        if ($token === '' || $email === '') {
            return null;
        }

        return Order::query()
            ->where('tracking_access_token_hash', hash('sha256', $token))
            ->whereRaw('LOWER(customer_reference) = ?', [Str::lower(trim($email))])
            ->where('tracking_access_token_expires_at', '>', now())
            ->with(['shippingAddress', 'lines'])
            ->first();
    }
}
