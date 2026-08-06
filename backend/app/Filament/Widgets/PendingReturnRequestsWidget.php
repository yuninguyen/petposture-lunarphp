<?php

namespace App\Filament\Widgets;

use App\Models\OrderReturnRequest;
use Filament\Widgets\StatsOverviewWidget as BaseWidget;
use Filament\Widgets\StatsOverviewWidget\Stat;

class PendingReturnRequestsWidget extends BaseWidget
{
    protected static ?int $sort = -1;

    protected int|string|array $columnSpan = 'full';

    protected int|string|array $columns = 3;

    protected static ?string $pollingInterval = '60s';

    protected function getStats(): array
    {
        $pendingReview = OrderReturnRequest::where('status', OrderReturnRequest::STATUS_REQUESTED)->count();

        $overdue = OrderReturnRequest::where('status', OrderReturnRequest::STATUS_REQUESTED)
            ->where('requested_at', '<', now()->subDays(OrderReturnRequest::PENDING_REVIEW_REMINDER_DAYS))
            ->count();

        $awaitingCompletion = OrderReturnRequest::where('status', OrderReturnRequest::STATUS_APPROVED)->count();

        return [
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
}
