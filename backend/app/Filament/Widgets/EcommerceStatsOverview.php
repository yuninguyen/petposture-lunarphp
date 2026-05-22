<?php

namespace App\Filament\Widgets;

use App\Models\User;
use Filament\Widgets\StatsOverviewWidget as BaseWidget;
use Filament\Widgets\StatsOverviewWidget\Stat;
use Illuminate\Support\Carbon;
use Lunar\Models\Order;
use Lunar\Models\Product;

class EcommerceStatsOverview extends BaseWidget
{
    protected static ?int $sort = -2;
    protected int|string|array $columnSpan = 'full';
    protected int|string|array $columns = 3;

    protected function getStats(): array
    {
        $now = Carbon::now();
        $thirtyDaysAgo = $now->copy()->subDays(30);
        $sixtyDaysAgo = $now->copy()->subDays(60);
        $todayStart = $now->copy()->startOfDay();

        // --- Revenue ---
        $revenue = Order::whereNotIn('status', ['cancelled'])->sum('total');
        $revenueLast30 = Order::whereNotIn('status', ['cancelled'])
            ->where('created_at', '>=', $thirtyDaysAgo)->sum('total');
        $revenuePrev30 = Order::whereNotIn('status', ['cancelled'])
            ->whereBetween('created_at', [$sixtyDaysAgo, $thirtyDaysAgo])->sum('total');

        $revenueTrend = $revenuePrev30 > 0
            ? round((($revenueLast30 - $revenuePrev30) / $revenuePrev30) * 100, 1)
            : 0;
        $revenueUp = $revenueTrend >= 0;

        $revenueChart = [];
        for ($i = 6; $i >= 0; $i--) {
            $day = $now->copy()->subDays($i)->startOfDay();
            $revenueChart[] = (int) Order::whereNotIn('status', ['cancelled'])
                ->whereBetween('created_at', [$day, $day->copy()->endOfDay()])
                ->sum('total');
        }

        // --- Orders ---
        $totalOrders = Order::count();
        $ordersLast30 = Order::where('created_at', '>=', $thirtyDaysAgo)->count();
        $ordersPrev30 = Order::whereBetween('created_at', [$sixtyDaysAgo, $thirtyDaysAgo])->count();

        $ordersTrend = $ordersPrev30 > 0
            ? round((($ordersLast30 - $ordersPrev30) / $ordersPrev30) * 100, 1)
            : 0;
        $ordersUp = $ordersTrend >= 0;

        $ordersChart = [];
        for ($i = 6; $i >= 0; $i--) {
            $day = $now->copy()->subDays($i)->startOfDay();
            $ordersChart[] = Order::whereBetween('created_at', [$day, $day->copy()->endOfDay()])->count();
        }

        // --- Products ---
        $activeProducts = Product::where('status', 'published')->count();

        // --- Customers ---
        $totalCustomers = (function () {
            try {
                return User::role('customer')->count();
            } catch (\Spatie\Permission\Exceptions\RoleDoesNotExist $e) {
                return User::count();
            }
        })();

        $customersLast30 = (function () use ($thirtyDaysAgo) {
            try {
                return User::role('customer')->where('created_at', '>=', $thirtyDaysAgo)->count();
            } catch (\Spatie\Permission\Exceptions\RoleDoesNotExist $e) {
                return User::where('created_at', '>=', $thirtyDaysAgo)->count();
            }
        })();

        $customersPrev30 = (function () use ($sixtyDaysAgo, $thirtyDaysAgo) {
            try {
                return User::role('customer')->whereBetween('created_at', [$sixtyDaysAgo, $thirtyDaysAgo])->count();
            } catch (\Spatie\Permission\Exceptions\RoleDoesNotExist $e) {
                return User::whereBetween('created_at', [$sixtyDaysAgo, $thirtyDaysAgo])->count();
            }
        })();

        $customersTrend = $customersPrev30 > 0
            ? round((($customersLast30 - $customersPrev30) / $customersPrev30) * 100, 1)
            : 0;
        $customersUp = $customersTrend >= 0;

        // --- Today ---
        $todayRevenue = Order::whereNotIn('status', ['cancelled'])
            ->where('created_at', '>=', $todayStart)->sum('total');
        $todayOrders = Order::where('created_at', '>=', $todayStart)->count();

        return [
            Stat::make(__('admin.dashboard.stats.revenue.label'), '$' . number_format($revenue / 100, 2))
                ->description(abs($revenueTrend) . '% ' . ($revenueUp ? 'increase' : 'decrease') . ' vs previous 30 days')
                ->descriptionIcon($revenueUp ? 'heroicon-m-arrow-trending-up' : 'heroicon-m-arrow-trending-down')
                ->icon('heroicon-o-banknotes')
                ->chart($revenueChart)
                ->color('success'),

            Stat::make(__('admin.dashboard.stats.orders.label'), number_format($totalOrders))
                ->description(abs($ordersTrend) . '% ' . ($ordersUp ? 'increase' : 'decrease') . ' vs previous 30 days')
                ->descriptionIcon($ordersUp ? 'heroicon-m-arrow-trending-up' : 'heroicon-m-arrow-trending-down')
                ->icon('heroicon-o-shopping-bag')
                ->chart($ordersChart)
                ->color('primary'),

            Stat::make(__('admin.dashboard.stats.products.label'), number_format($activeProducts))
                ->description(__('admin.dashboard.stats.products.description'))
                ->descriptionIcon('heroicon-m-check-badge')
                ->icon('heroicon-o-tag')
                ->color('warning'),

            Stat::make(__('admin.dashboard.stats.customers.label'), number_format($totalCustomers))
                ->description(abs($customersTrend) . '% ' . ($customersUp ? 'increase' : 'decrease') . ' vs previous 30 days')
                ->descriptionIcon($customersUp ? 'heroicon-m-arrow-trending-up' : 'heroicon-m-arrow-trending-down')
                ->icon('heroicon-o-user-group')
                ->color('info'),

            Stat::make("Today's Revenue", '$' . number_format($todayRevenue / 100, 2))
                ->description('Revenue earned today')
                ->descriptionIcon('heroicon-m-sun')
                ->icon('heroicon-o-currency-dollar')
                ->color('success'),

            Stat::make("Today's Orders", number_format($todayOrders))
                ->description('Orders placed today')
                ->descriptionIcon('heroicon-m-clock')
                ->icon('heroicon-o-clipboard-document-list')
                ->color('primary'),
        ];
    }
}
