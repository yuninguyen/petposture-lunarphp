<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\DashboardConversionRequest;
use App\Models\CheckoutSession;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Carbon;
use Lunar\Models\Cart;
use Lunar\Models\Order;

class DashboardConversionController extends Controller
{
    public function index(DashboardConversionRequest $request): JsonResponse
    {
        if ($request->usesPreset()) {
            $primary = $request->resolveRange();
            $periodStart = $primary['start'];
            $periodEnd = $primary['end'];

            $cartsCreated = Cart::query()
                ->whereBetween('created_at', [$periodStart, $periodEnd])
                ->count();

            $checkoutsStarted = CheckoutSession::query()
                ->where('status', '!=', 'cart')
                ->whereBetween('created_at', [$periodStart, $periodEnd])
                ->count();

            $ordersCompleted = Order::query()
                ->whereNotIn('status', ['cancelled'])
                ->whereBetween('created_at', [$periodStart, $periodEnd])
                ->count();

            $rangeData = [
                'preset' => (string) $request->validated('preset'),
                'start' => $periodStart->toDateString(),
                'end' => $periodEnd->toDateString(),
                'label' => $primary['label'],
            ];
        } else {
            $now = Carbon::now();
            $range = $request->range();
            $rangeDays = $request->rangeDays();

            $periodStart = $rangeDays ? $now->copy()->subDays($rangeDays) : null;

            $cartsCreated = Cart::query()
                ->when($periodStart, fn ($query) => $query->where('created_at', '>=', $periodStart))
                ->count();

            $checkoutsStarted = CheckoutSession::query()
                ->where('status', '!=', 'cart')
                ->when($periodStart, fn ($query) => $query->where('created_at', '>=', $periodStart))
                ->count();

            $ordersCompleted = Order::query()
                ->whereNotIn('status', ['cancelled'])
                ->when($periodStart, fn ($query) => $query->where('created_at', '>=', $periodStart))
                ->count();

            $rangeData = $range;
        }

        $cartAbandonmentRate = $cartsCreated > 0
            ? round(max(0, $cartsCreated - $checkoutsStarted) / $cartsCreated, 4)
            : 0.0;

        $checkoutAbandonmentRate = $checkoutsStarted > 0
            ? round(max(0, $checkoutsStarted - $ordersCompleted) / $checkoutsStarted, 4)
            : 0.0;

        return response()->json([
            'data' => [
                'range' => $rangeData,
                'carts_created' => $cartsCreated,
                'checkouts_started' => $checkoutsStarted,
                'orders_completed' => $ordersCompleted,
                'cart_abandonment_rate' => $cartAbandonmentRate,
                'checkout_abandonment_rate' => $checkoutAbandonmentRate,
            ],
        ]);
    }
}
