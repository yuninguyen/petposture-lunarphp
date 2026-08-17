<?php

namespace App\Filament\Widgets;

use App\Models\OrderReturnRequest;
use Filament\Widgets\Concerns\InteractsWithPageFilters;
use Filament\Widgets\StatsOverviewWidget as BaseWidget;
use Filament\Widgets\StatsOverviewWidget\Stat;
use Lunar\Models\Order;

class PendingReturnRequestsWidget extends BaseWidget
{
    use InteractsWithPageFilters;

    protected static ?int $sort = -1;

    protected int|string|array $columnSpan = 'full';

    protected int|string|array $columns = 4;

    protected static ?string $pollingInterval = '60s';

    public function getHeading(): ?string
    {
        return __('admin.dashboard.returns.heading');
    }

    protected function getStats(): array
    {
        $now = now();
        $rangeDays = match ($this->filters['range'] ?? '30') {
            '7' => 7,
            '90' => 90,
            '365' => 365,
            'all' => null,
            default => 30,
        };
        $periodStart = $rangeDays ? $now->copy()->subDays($rangeDays) : null;
        $prevPeriodStart = $rangeDays ? $now->copy()->subDays($rangeDays * 2) : null;

        $totalOrders = Order::when($periodStart, fn ($query) => $query->where('created_at', '>=', $periodStart))->count();
        $ordersPrev = $rangeDays
            ? Order::whereBetween('created_at', [$prevPeriodStart, $periodStart])->count()
            : 0;

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
        $refundTrend = $refundRatePrev > 0 ? round((($refundRate - $refundRatePrev) / $refundRatePrev) * 100, 1) : 0;

        $pendingReview = OrderReturnRequest::where('status', OrderReturnRequest::STATUS_REQUESTED)->count();

        $overdue = OrderReturnRequest::where('status', OrderReturnRequest::STATUS_REQUESTED)
            ->where('requested_at', '<', now()->subDays(OrderReturnRequest::PENDING_REVIEW_REMINDER_DAYS))
            ->count();

        $awaitingCompletion = OrderReturnRequest::where('status', OrderReturnRequest::STATUS_APPROVED)->count();

        return [
            Stat::make(__('admin.dashboard.stats.refund_rate.label'), $refundRate.'%')
                ->description($rangeDays ? $this->trendLabel($refundTrend) : __('admin.dashboard.trend.all_time'))
                ->descriptionIcon($rangeDays ? $this->trendIcon($refundTrend) : null)
                ->icon('heroicon-o-arrow-uturn-left')
                ->color($refundRate > 10 ? 'danger' : 'warning'),

            Stat::make(__('admin.dashboard.returns.pending_review.label'), number_format($pendingReview))
                ->description(__('admin.dashboard.returns.pending_review.description'))
                ->descriptionIcon('heroicon-m-clock')
                ->icon('heroicon-o-arrow-uturn-left')
                ->color($pendingReview > 0 ? 'warning' : 'success'),

            Stat::make(__('admin.dashboard.returns.overdue.label'), number_format($overdue))
                ->description(__('admin.dashboard.returns.overdue.description'))
                ->descriptionIcon('heroicon-m-exclamation-triangle')
                ->icon('heroicon-o-exclamation-triangle')
                ->color($overdue > 0 ? 'danger' : 'success'),

            Stat::make(__('admin.dashboard.returns.awaiting_completion.label'), number_format($awaitingCompletion))
                ->description(__('admin.dashboard.returns.awaiting_completion.description'))
                ->descriptionIcon('heroicon-m-truck')
                ->icon('heroicon-o-truck')
                ->color('info'),
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
