<?php

namespace App\Filament\Widgets;

use App\Models\Setting;
use App\Models\User;
use Filament\Widgets\Widget;
use Lunar\Models\Order;
use Spatie\Permission\Exceptions\RoleDoesNotExist;

class SalesSidebarWidget extends Widget
{
    protected static string $view = 'filament.widgets.sales-sidebar';

    protected static ?int $sort = 1;

    protected int|string|array $columnSpan = [
        'default' => 1,
        'md' => 2,
        'xl' => 1,
    ];

    protected function getViewData(): array
    {
        return [
            'trafficSources' => $this->getTrafficSources(),
            'goals' => $this->getGoals(),
        ];
    }

    protected function getTrafficSources(): array
    {
        // Placeholder until an analytics provider (GA4 / Plausible) is connected.
        return [
            ['label' => __('admin.dashboard.traffic.direct'), 'percent' => null, 'color' => '#df8448'],
            ['label' => __('admin.dashboard.traffic.organic'), 'percent' => null, 'color' => '#0d9488'],
            ['label' => __('admin.dashboard.traffic.social'), 'percent' => null, 'color' => '#f59e0b'],
            ['label' => __('admin.dashboard.traffic.referral'), 'percent' => null, 'color' => '#3e4c57'],
        ];
    }

    protected function getGoals(): array
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

        return $goals;
    }
}
