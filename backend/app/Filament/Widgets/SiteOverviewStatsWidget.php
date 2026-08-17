<?php

namespace App\Filament\Widgets;

use Filament\Widgets\Concerns\InteractsWithPageFilters;
use Filament\Widgets\StatsOverviewWidget as BaseWidget;
use Filament\Widgets\StatsOverviewWidget\Stat;
use Illuminate\Support\Carbon;
use Lunar\Models\Order;

class SiteOverviewStatsWidget extends BaseWidget
{
    use InteractsWithPageFilters;

    protected static ?int $sort = -3;

    protected int|string|array $columnSpan = 'full';

    protected int|string|array $columns = 4;

    protected function getStats(): array
    {
        $now = Carbon::now();
        $rangeDays = match ($this->filters['range'] ?? '30') {
            '7' => 7,
            '90' => 90,
            '365' => 365,
            'all' => null,
            default => 30,
        };
        $periodStart = $rangeDays ? $now->copy()->subDays($rangeDays) : null;
        $prevPeriodStart = $rangeDays ? $now->copy()->subDays($rangeDays * 2) : null;

        $sales = Order::whereNotIn('status', ['cancelled'])
            ->when($periodStart, fn ($query) => $query->where('created_at', '>=', $periodStart))
            ->sum('total');
        $salesPrev = $rangeDays
            ? Order::whereNotIn('status', ['cancelled'])
                ->whereBetween('created_at', [$prevPeriodStart, $periodStart])->sum('total')
            : 0;
        $salesTrend = $salesPrev > 0 ? round((($sales - $salesPrev) / $salesPrev) * 100, 1) : 0;

        $totalOrders = Order::when($periodStart, fn ($query) => $query->where('created_at', '>=', $periodStart))->count();
        $ordersPrev = $rangeDays
            ? Order::whereBetween('created_at', [$prevPeriodStart, $periodStart])->count()
            : 0;
        $ordersTrend = $ordersPrev > 0 ? round((($totalOrders - $ordersPrev) / $ordersPrev) * 100, 1) : 0;

        $aov = $totalOrders > 0 ? $sales / $totalOrders : 0;
        $aovPrev = $ordersPrev > 0 ? $salesPrev / $ordersPrev : 0;
        $aovTrend = $aovPrev > 0 ? round((($aov - $aovPrev) / $aovPrev) * 100, 1) : 0;

        return [
            Stat::make(__('admin.dashboard.stats.sales.label'), '$'.number_format($sales / 100, 2))
                ->description($rangeDays ? $this->trendLabel($salesTrend) : __('admin.dashboard.trend.all_time'))
                ->descriptionIcon($rangeDays ? $this->trendIcon($salesTrend) : null)
                ->icon('heroicon-o-banknotes')
                ->color('success'),

            Stat::make(__('admin.dashboard.stats.aov.label'), '$'.number_format($aov / 100, 2))
                ->description($rangeDays ? $this->trendLabel($aovTrend) : __('admin.dashboard.trend.all_time'))
                ->descriptionIcon($rangeDays ? $this->trendIcon($aovTrend) : null)
                ->icon('heroicon-o-calculator')
                ->color('info'),

            Stat::make(__('admin.dashboard.stats.active_users.label'), '—')
                ->description(__('admin.dashboard.stats.not_connected'))
                ->descriptionIcon('heroicon-m-link-slash')
                ->icon('heroicon-o-users')
                ->color('gray'),

            Stat::make(__('admin.dashboard.stats.orders.label'), number_format($totalOrders))
                ->description($rangeDays ? $this->trendLabel($ordersTrend) : __('admin.dashboard.trend.all_time'))
                ->descriptionIcon($rangeDays ? $this->trendIcon($ordersTrend) : null)
                ->icon('heroicon-o-shopping-bag')
                ->color('primary'),
        ];
    }

    protected function trendLabel(float $trend): string
    {
        return $trend >= 0
            ? __('admin.dashboard.trend.increase', ['trend' => abs($trend)])
            : __('admin.dashboard.trend.decrease', ['trend' => abs($trend)]);
    }

    protected function trendIcon(float $trend): string
    {
        return $trend >= 0 ? 'heroicon-m-arrow-trending-up' : 'heroicon-m-arrow-trending-down';
    }
}
