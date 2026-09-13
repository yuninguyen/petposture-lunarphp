<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\GoalsUpdateRequest;
use App\Models\Setting;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Lunar\Models\Order;
use Spatie\Permission\Exceptions\RoleDoesNotExist;

class GoalsController extends Controller
{
    public function index(): JsonResponse
    {
        $goals = $this->buildGoals();

        return response()->json([
            'data' => [
                'goals' => $goals,
            ],
        ]);
    }

    public function update(GoalsUpdateRequest $request): JsonResponse
    {
        $keys = [
            'monthly_revenue_target' => 'int',
            'monthly_orders_target' => 'int',
            'monthly_new_customers_target' => 'int',
        ];

        foreach ($keys as $key => $type) {
            if ($request->has($key)) {
                $value = $request->input($key);
                if ($value === null || $value === '') {
                    Setting::where('key', $key)->first()?->delete();
                } else {
                    Setting::set($key, (int) $value, $type, 'goals');
                }
            }
        }

        return $this->index();
    }

    private function buildGoals(): array
    {
        $monthStart = now()->startOfMonth();

        $revenueActual = round((int) Order::whereNotIn('status', ['cancelled'])
            ->where('created_at', '>=', $monthStart)
            ->sum('total') / 100, 2);

        $ordersActual = Order::whereNotIn('status', ['cancelled'])
            ->where('created_at', '>=', $monthStart)
            ->count();

        $newCustomersActual = (function () use ($monthStart) {
            try {
                return User::role('customer')->where('created_at', '>=', $monthStart)->count();
            } catch (RoleDoesNotExist) {
                return User::where('created_at', '>=', $monthStart)->count();
            }
        })();

        $revenueSetting = Setting::where('key', 'monthly_revenue_target')->first();
        $ordersSetting = Setting::where('key', 'monthly_orders_target')->first();
        $newCustomersSetting = Setting::where('key', 'monthly_new_customers_target')->first();

        $goals = [
            [
                'key' => 'monthly_revenue_target',
                'label' => 'Monthly Revenue Target',
                'actual' => $revenueActual,
                'target' => $revenueSetting !== null ? (float) $revenueSetting->cast_value : null,
                'unit' => 'currency',
            ],
            [
                'key' => 'monthly_orders_target',
                'label' => 'Monthly Orders Target',
                'actual' => $ordersActual,
                'target' => $ordersSetting !== null ? (int) $ordersSetting->cast_value : null,
                'unit' => 'number',
            ],
            [
                'key' => 'monthly_new_customers_target',
                'label' => 'Monthly New Customers Target',
                'actual' => $newCustomersActual,
                'target' => $newCustomersSetting !== null ? (int) $newCustomersSetting->cast_value : null,
                'unit' => 'number',
            ],
        ];

        foreach ($goals as &$goal) {
            if ($goal['target'] !== null && $goal['target'] > 0) {
                $uncapped = round(($goal['actual'] / $goal['target']) * 100, 1);
                $goal['uncapped_percent'] = $uncapped;
                $goal['percent'] = min(100, (int) round($uncapped));
            } else {
                $goal['uncapped_percent'] = null;
                $goal['percent'] = null;
            }
        }

        return $goals;
    }
}
