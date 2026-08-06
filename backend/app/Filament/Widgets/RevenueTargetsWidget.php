<?php

namespace App\Filament\Widgets;

use App\Models\Setting;
use App\Models\User;
use Filament\Widgets\Widget;
use Lunar\Models\Order;
use Spatie\Permission\Exceptions\RoleDoesNotExist;

class RevenueTargetsWidget extends Widget
{
    protected static string $view = 'filament.widgets.revenue-targets';

    protected static ?int $sort = 0;

    protected int|string|array $columnSpan = 'full';

    protected function getViewData(): array
    {
        $monthStart = now()->startOfMonth();

        $revenueActual = Order::whereNotIn('status', ['cancelled'])
            ->where('created_at', '>=', $monthStart)
            ->sum('total') / 100;

        $ordersActual = Order::where('created_at', '>=', $monthStart)->count();

        $newCustomersActual = (function () use ($monthStart) {
            try {
                return User::role('customer')->where('created_at', '>=', $monthStart)->count();
            } catch (RoleDoesNotExist $e) {
                return User::where('created_at', '>=', $monthStart)->count();
            }
        })();

        $goals = [
            [
                'label' => __('admin.dashboard.goals.revenue'),
                'actual' => $revenueActual,
                'target' => (float) Setting::get('monthly_revenue_target', 0),
                'format' => 'currency',
            ],
            [
                'label' => __('admin.dashboard.goals.orders'),
                'actual' => $ordersActual,
                'target' => (int) Setting::get('monthly_orders_target', 0),
                'format' => 'number',
            ],
            [
                'label' => __('admin.dashboard.goals.new_customers'),
                'actual' => $newCustomersActual,
                'target' => (int) Setting::get('monthly_new_customers_target', 0),
                'format' => 'number',
            ],
        ];

        foreach ($goals as &$goal) {
            $goal['percent'] = $goal['target'] > 0
                ? min(100, (int) round(($goal['actual'] / $goal['target']) * 100))
                : null;
        }

        return [
            'heading' => __('admin.dashboard.goals.heading', ['month' => now()->translatedFormat('F Y')]),
            'goals' => $goals,
        ];
    }
}
