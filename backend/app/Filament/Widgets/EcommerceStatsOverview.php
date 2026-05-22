<?php

namespace App\Filament\Widgets;

use App\Models\User;
use Filament\Widgets\StatsOverviewWidget as BaseWidget;
use Filament\Widgets\StatsOverviewWidget\Stat;
use Lunar\Models\Order;
use Lunar\Models\Product;

class EcommerceStatsOverview extends BaseWidget
{
    protected function getStats(): array
    {
        $revenue = Order::whereNotIn('status', ['cancelled'])->sum('total');

        return [
            Stat::make(__('admin.dashboard.stats.revenue.label'), '$' . number_format($revenue / 100, 2))
                ->description(__('admin.dashboard.stats.revenue.description'))
                ->color('primary'),
            Stat::make(__('admin.dashboard.stats.orders.label'), Order::count())
                ->description(__('admin.dashboard.stats.orders.description')),
            Stat::make(__('admin.dashboard.stats.products.label'), Product::where('status', 'published')->count())
                ->description(__('admin.dashboard.stats.products.description')),
            Stat::make(__('admin.dashboard.stats.customers.label'), (function() {
                try {
                    return User::role('customer')->count();
                } catch (\Spatie\Permission\Exceptions\RoleDoesNotExist $e) {
                    return User::count();
                }
            })())
                ->description(__('admin.dashboard.stats.customers.description')),
        ];
    }
}
