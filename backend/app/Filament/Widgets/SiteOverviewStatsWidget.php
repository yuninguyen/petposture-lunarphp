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

        $revenue = Order::whereNotIn('status', ['cancelled'])
            ->when($periodStart, fn ($query) => $query->where('created_at', '>=', $periodStart))
            ->sum('total');
        $revenuePrev = $rangeDays
            ? Order::whereNotIn('status', ['cancelled'])
                ->whereBetween('created_at', [$prevPeriodStart, $periodStart])->sum('total')
            : 0;
        $revenueTrend = $revenuePrev > 0 ? round((($revenue - $revenuePrev) / $revenuePrev) * 100, 1) : 0;

        $totalOrders = Order::when($periodStart, fn ($query) => $query->where('created_at', '>=', $periodStart))->count();
        $ordersPrev = $rangeDays
            ? Order::whereBetween('created_at', [$prevPeriodStart, $periodStart])->count()
            : 0;
        $ordersTrend = $ordersPrev > 0 ? round((($totalOrders - $ordersPrev) / $ordersPrev) * 100, 1) : 0;

        return [
            Stat::make(__('admin.dashboard.stats.revenue.label'), '$'.number_format($revenue / 100, 2))
                ->description($rangeDays ? $this->trendLabel($revenueTrend) : __('admin.dashboard.trend.all_time'))
                ->descriptionIcon($rangeDays ? $this->trendIcon($revenueTrend) : null)
                ->icon('heroicon-o-banknotes')
                ->color('success'),

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

            Stat::make(__('admin.dashboard.stats.page_views.label'), '—')
                ->description(__('admin.dashboard.stats.not_connected'))
                ->descriptionIcon('heroicon-m-link-slash')
                ->icon('heroicon-o-eye')
                ->color('gray'),
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
