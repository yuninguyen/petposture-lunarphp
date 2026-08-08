<?php

namespace App\Filament\Widgets;

use App\Models\AffiliateClick;
use Filament\Widgets\StatsOverviewWidget as BaseWidget;
use Filament\Widgets\StatsOverviewWidget\Stat;
use Illuminate\Support\Carbon;

class AffiliateClicksOverview extends BaseWidget
{
    protected static bool $isLazy = false;

    protected int|string|array $columnSpan = 'full';

    protected function getStats(): array
    {
        $now = Carbon::now();

        $last7Days = AffiliateClick::where('created_at', '>=', $now->copy()->subDays(7))->count();
        $last30Days = AffiliateClick::where('created_at', '>=', $now->copy()->subDays(30))->count();
        $allTime = AffiliateClick::count();

        $topNetwork = AffiliateClick::query()
            ->selectRaw('affiliate_network_id, count(*) as total')
            ->whereNotNull('affiliate_network_id')
            ->where('created_at', '>=', $now->copy()->subDays(30))
            ->groupBy('affiliate_network_id')
            ->orderByDesc('total')
            ->with('network')
            ->first();

        return [
            Stat::make(__('Clicks (7 days)'), number_format($last7Days))
                ->icon('heroicon-o-cursor-arrow-rays')
                ->color('primary'),

            Stat::make(__('Clicks (30 days)'), number_format($last30Days))
                ->icon('heroicon-o-cursor-arrow-rays')
                ->color('primary'),

            Stat::make(__('Clicks (all time)'), number_format($allTime))
                ->icon('heroicon-o-chart-bar')
                ->color('gray'),

            Stat::make(__('Top network (30 days)'), $topNetwork?->network?->name ?? __('—'))
                ->description($topNetwork ? __(':count clicks', ['count' => number_format($topNetwork->total)]) : null)
                ->icon('heroicon-o-trophy')
                ->color('success'),
        ];
    }
}
