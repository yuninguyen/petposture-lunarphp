<?php

namespace App\Filament\Widgets;

use Filament\Widgets\Concerns\InteractsWithPageFilters;
use Illuminate\Support\Carbon;
use Leandrocfe\FilamentApexCharts\Widgets\ApexChartWidget;
use Lunar\Models\Order;

class SalesOverviewChart extends ApexChartWidget
{
    use InteractsWithPageFilters;

    protected static ?string $chartId = 'salesOverviewChart';

    protected static ?int $sort = 1;

    protected int|string|array $columnSpan = [
        'default' => 1,
        'md' => 2,
        'xl' => 2,
    ];

    public function getHeading(): ?string
    {
        return __('admin.dashboard.sales_overview');
    }

    protected function getOptions(): array
    {
        $now = Carbon::now();
        $rangeDays = match ($this->filters['range'] ?? '30') {
            '7' => 7,
            '90' => 90,
            '365' => 365,
            'all' => null,
            default => 30,
        };

        $labels = [];
        $revenueData = [];
        $ordersData = [];

        if ($rangeDays !== null && $rangeDays <= 90) {
            // Short ranges: one point per day.
            for ($i = $rangeDays - 1; $i >= 0; $i--) {
                $dayStart = $now->copy()->subDays($i)->startOfDay();
                $dayEnd = $dayStart->copy()->endOfDay();
                $labels[] = $dayStart->format('M j');

                $query = Order::whereBetween('created_at', [$dayStart, $dayEnd]);
                $ordersData[] = (clone $query)->count();
                $revenueData[] = round((clone $query)->whereNotIn('status', ['cancelled'])->sum('total') / 100, 2);
            }
        } else {
            // 365 days or "all time": one point per month.
            $monthsBack = 11;

            if ($rangeDays === null) {
                $earliestOrder = Order::oldest('created_at')->value('created_at');
                if ($earliestOrder) {
                    $monthsBack = min(23, $now->diffInMonths(Carbon::parse($earliestOrder)));
                }
            }

            for ($i = $monthsBack; $i >= 0; $i--) {
                $monthStart = $now->copy()->subMonths($i)->startOfMonth();
                $monthEnd = $monthStart->copy()->endOfMonth();
                $labels[] = ucfirst($monthStart->translatedFormat('M Y'));

                $query = Order::whereBetween('created_at', [$monthStart, $monthEnd]);
                $ordersData[] = (clone $query)->count();
                $revenueData[] = round((clone $query)->whereNotIn('status', ['cancelled'])->sum('total') / 100, 2);
            }
        }

        return [
            'chart' => [
                'type' => 'line',
                'height' => 460,
                'toolbar' => ['show' => false],
                'fontFamily' => 'Google Sans Flex, sans-serif',
            ],
            'series' => [
                [
                    'name' => __('admin.dashboard.stats.revenue.label'),
                    'data' => $revenueData,
                ],
                [
                    'name' => __('admin.dashboard.stats.orders.label'),
                    'data' => $ordersData,
                ],
            ],
            'xaxis' => [
                'categories' => $labels,
                'labels' => ['style' => ['fontSize' => '11px']],
            ],
            'yaxis' => [
                [
                    'title' => ['text' => __('admin.dashboard.stats.revenue.label'), 'style' => ['fontSize' => '11px']],
                    'labels' => ['style' => ['fontSize' => '11px']],
                    'decimalsInFloat' => 0,
                ],
                [
                    'opposite' => true,
                    'title' => ['text' => __('admin.dashboard.stats.orders.label'), 'style' => ['fontSize' => '11px']],
                    'labels' => ['style' => ['fontSize' => '11px']],
                    'decimalsInFloat' => 0,
                ],
            ],
            'colors' => ['#df8448', '#3e4c57'],
            'stroke' => ['curve' => 'smooth', 'width' => 3],
            'dataLabels' => ['enabled' => false],
            'legend' => ['fontFamily' => 'Google Sans Flex, sans-serif'],
            'tooltip' => ['shared' => true],
        ];
    }
}
