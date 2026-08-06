<?php

namespace App\Filament\Widgets;

use Illuminate\Support\Carbon;
use Leandrocfe\FilamentApexCharts\Widgets\ApexChartWidget;
use Lunar\Models\Order;

class SalesOverviewChart extends ApexChartWidget
{
    protected static ?string $chartId = 'salesOverviewChart';

    protected static ?int $sort = 1;

    protected int|string|array $columnSpan = [
        'default' => 1,
        'md' => 2,
        'xl' => 2,
    ];

    public ?string $filter = 'month';

    protected function getFilters(): ?array
    {
        return [
            'today' => __('admin.dashboard.filters.granularity.today'),
            'month' => __('admin.dashboard.filters.granularity.month'),
            'year' => __('admin.dashboard.filters.granularity.year'),
        ];
    }

    public function getHeading(): ?string
    {
        return __('admin.dashboard.sales_overview');
    }

    protected function getOptions(): array
    {
        $now = Carbon::now();
        $labels = [];
        $revenueData = [];
        $ordersData = [];

        switch ($this->filter) {
            case 'today':
                for ($hour = 0; $hour < 24; $hour++) {
                    $slotStart = $now->copy()->startOfDay()->addHours($hour);
                    $slotEnd = $slotStart->copy()->addHour();
                    $labels[] = $slotStart->format('ga');

                    $query = Order::whereBetween('created_at', [$slotStart, $slotEnd]);
                    $ordersData[] = (clone $query)->count();
                    $revenueData[] = round((clone $query)->whereNotIn('status', ['cancelled'])->sum('total') / 100, 2);
                }
                break;

            case 'year':
                for ($i = 11; $i >= 0; $i--) {
                    $monthStart = $now->copy()->subMonths($i)->startOfMonth();
                    $monthEnd = $monthStart->copy()->endOfMonth();
                    $labels[] = ucfirst($monthStart->translatedFormat('M Y'));

                    $query = Order::whereBetween('created_at', [$monthStart, $monthEnd]);
                    $ordersData[] = (clone $query)->count();
                    $revenueData[] = round((clone $query)->whereNotIn('status', ['cancelled'])->sum('total') / 100, 2);
                }
                break;

            default: // month
                $daysInMonth = $now->daysInMonth;
                for ($day = 1; $day <= $daysInMonth; $day++) {
                    $dayStart = $now->copy()->startOfMonth()->addDays($day - 1);
                    $dayEnd = $dayStart->copy()->endOfDay();
                    $labels[] = $dayStart->format('j');

                    $query = Order::whereBetween('created_at', [$dayStart, $dayEnd]);
                    $ordersData[] = (clone $query)->count();
                    $revenueData[] = round((clone $query)->whereNotIn('status', ['cancelled'])->sum('total') / 100, 2);
                }
                break;
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
