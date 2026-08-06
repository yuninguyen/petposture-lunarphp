<?php

namespace App\Filament\Widgets;

use App\Models\OrderReturnRequest;
use Filament\Widgets\Concerns\InteractsWithPageFilters;
use Filament\Widgets\StatsOverviewWidget as BaseWidget;
use Filament\Widgets\StatsOverviewWidget\Stat;
use Illuminate\Support\Carbon;
use Lunar\Models\Order;

class EcommerceStatsOverview extends BaseWidget
{
    use InteractsWithPageFilters;

    protected static ?int $sort = -2;

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

        // --- Sales ---
        $sales = Order::whereNotIn('status', ['cancelled'])
            ->when($periodStart, fn ($query) => $query->where('created_at', '>=', $periodStart))
            ->sum('total');
        $salesPrev = $rangeDays
            ? Order::whereNotIn('status', ['cancelled'])
                ->whereBetween('created_at', [$prevPeriodStart, $periodStart])->sum('total')
            : 0;
        $salesTrend = $this->trend($sales, $salesPrev);

        // --- Orders (for AOV / refund-rate denominator only, not shown here — see SiteOverviewStatsWidget) ---
        $totalOrders = Order::when($periodStart, fn ($query) => $query->where('created_at', '>=', $periodStart))
            ->count();
        $ordersPrev = $rangeDays
            ? Order::whereBetween('created_at', [$prevPeriodStart, $periodStart])->count()
            : 0;

        // --- Average Order Value ---
        $aov = $totalOrders > 0 ? $sales / $totalOrders : 0;
        $aovPrev = $ordersPrev > 0 ? $salesPrev / $ordersPrev : 0;
        $aovTrend = $this->trend($aov, $aovPrev);

        // --- Refund rate (approved/completed return requests ÷ orders placed) ---
        $refundedCount = OrderReturnRequest::whereIn('status', [
            OrderReturnRequest::STATUS_APPROVED,
            OrderReturnRequest::STATUS_COMPLETED,
        ])
            ->when($periodStart, fn ($query) => $query->where('requested_at', '>=', $periodStart))
            ->count();
        $refundRate = $totalOrders > 0 ? round(($refundedCount / $totalOrders) * 100, 1) : 0;

        $refundedCountPrev = $rangeDays
            ? OrderReturnRequest::whereIn('status', [
                OrderReturnRequest::STATUS_APPROVED,
                OrderReturnRequest::STATUS_COMPLETED,
            ])->whereBetween('requested_at', [$prevPeriodStart, $periodStart])->count()
            : 0;
        $refundRatePrev = $ordersPrev > 0 ? round(($refundedCountPrev / $ordersPrev) * 100, 1) : 0;
        $refundTrend = $this->trend($refundRate, $refundRatePrev);

        return [
            Stat::make(__('admin.dashboard.stats.sales.label'), '$'.number_format($sales / 100, 2))
                ->description($rangeDays ? $this->trendLabel($salesTrend) : __('admin.dashboard.trend.all_time'))
                ->descriptionIcon($rangeDays ? $this->trendIcon($salesTrend) : null)
                ->icon('heroicon-o-currency-dollar')
                ->color('success'),

            Stat::make(__('admin.dashboard.stats.aov.label'), '$'.number_format($aov / 100, 2))
                ->description($rangeDays ? $this->trendLabel($aovTrend) : __('admin.dashboard.trend.all_time'))
                ->descriptionIcon($rangeDays ? $this->trendIcon($aovTrend) : null)
                ->icon('heroicon-o-calculator')
                ->color('info'),

            Stat::make(__('admin.dashboard.stats.conversion_rate.label'), '—')
                ->description(__('admin.dashboard.stats.not_connected'))
                ->descriptionIcon('heroicon-m-link-slash')
                ->icon('heroicon-o-funnel')
                ->color('gray'),

            Stat::make(__('admin.dashboard.stats.refund_rate.label'), $refundRate.'%')
                ->description($rangeDays ? $this->trendLabel($refundTrend) : __('admin.dashboard.trend.all_time'))
                ->descriptionIcon($rangeDays ? $this->trendIcon($refundTrend) : null)
                ->icon('heroicon-o-arrow-uturn-left')
                ->color($refundRate > 10 ? 'danger' : 'warning'),
        ];
    }

    protected function trend(float $current, float $previous): float
    {
        return $previous > 0 ? round((($current - $previous) / $previous) * 100, 1) : 0;
    }

    /**
     * Wording always reflects the metric's literal direction (up/down) —
     * not whether that direction is "good," since some stats (e.g. refund rate)
     * are better when they go down.
     */
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
