<?php

namespace App\Filament\Widgets;

use Filament\Widgets\Concerns\InteractsWithPageFilters;
use Leandrocfe\FilamentApexCharts\Widgets\ApexChartWidget;
use Lunar\Models\OrderLine;

class SalesByCategoryChart extends ApexChartWidget
{
    use InteractsWithPageFilters;

    protected static ?string $chartId = 'salesByCategory';

    protected static ?int $sort = 3;

    protected int|string|array $columnSpan = [
        'default' => 1,
        'md' => 2,
        'xl' => 1,
    ];

    protected static ?string $pollingInterval = null;

    public function getHeading(): ?string
    {
        return __('admin.dashboard.sales_by_category');
    }

    protected function getOptions(): array
    {
        $rangeDays = match ($this->filters['range'] ?? '30') {
            '7' => 7,
            '30' => 30,
            '90' => 90,
            '365' => 365,
            default => null,
        };

        $lines = OrderLine::query()
            ->whereType('physical')
            ->when($rangeDays, fn ($query) => $query->whereHas(
                'order',
                fn ($orderQuery) => $orderQuery->where('created_at', '>=', now()->subDays($rangeDays))
            ))
            ->with('purchasable.product.collections')
            ->get();

        $totals = [];
        foreach ($lines as $line) {
            $product = $line->purchasable?->product;
            $collectionName = $product?->collections?->first()?->translateAttribute('name') ?? __('admin.dashboard.uncategorized');
            $totals[$collectionName] = ($totals[$collectionName] ?? 0) + ($line->sub_total?->decimal ?? 0);
        }

        arsort($totals);
        $totals = array_slice($totals, 0, 6, true);
        $totals = array_reverse($totals, true); // largest bar on top

        if (empty($totals)) {
            $totals = [__('admin.dashboard.no_orders_yet') => 1];
        }

        return [
            'chart' => [
                'type' => 'bar',
                'height' => 380,
                'toolbar' => ['show' => false],
                'fontFamily' => 'Google Sans Flex, sans-serif',
            ],
            'plotOptions' => [
                'bar' => [
                    'horizontal' => true,
                    'borderRadius' => 4,
                    'barHeight' => '55%',
                ],
            ],
            'series' => [
                [
                    'name' => __('admin.dashboard.stats.revenue.label'),
                    'data' => array_values($totals),
                ],
            ],
            'xaxis' => [
                'categories' => array_keys($totals),
            ],
            'colors' => ['#df8448'],
            'dataLabels' => ['enabled' => false],
            'grid' => ['strokeDashArray' => 4],
        ];
    }
}
