<?php

namespace App\Filament\Widgets;

use Leandrocfe\FilamentApexCharts\Widgets\ApexChartWidget;
use Lunar\Models\Order;

class OrderStatusBreakdownChart extends ApexChartWidget
{
    protected static ?string $chartId = 'orderStatusBreakdown';
    protected static ?string $heading = 'Order Status Breakdown';
    protected static ?int $sort = 2;
    protected int|string|array $columnSpan = 1;
    protected static ?string $pollingInterval = '60s';

    protected function getOptions(): array
    {
        $statuses = [
            'awaiting-payment' => ['label' => 'Awaiting Payment', 'color' => '#f59e0b'],
            'payment-received' => ['label' => 'Payment Received', 'color' => '#3b82f6'],
            'processing'       => ['label' => 'Processing',       'color' => '#8b5cf6'],
            'shipped'          => ['label' => 'Shipped',          'color' => '#df8448'],
            'delivered'        => ['label' => 'Delivered',        'color' => '#10b981'],
            'cancelled'        => ['label' => 'Cancelled',        'color' => '#ef4444'],
        ];

        $counts = Order::selectRaw('status, COUNT(*) as total')
            ->groupBy('status')
            ->pluck('total', 'status')
            ->toArray();

        $labels  = [];
        $values  = [];
        $colors  = [];
        $total   = array_sum($counts);

        foreach ($statuses as $key => $meta) {
            $count = $counts[$key] ?? 0;
            if ($count === 0) continue;
            $labels[] = $meta['label'] . ' (' . $count . ')';
            $values[] = $count;
            $colors[] = $meta['color'];
        }

        if (empty($values)) {
            $labels = ['No Orders Yet'];
            $values = [1];
            $colors = ['#e2e8f0'];
        }

        return [
            'chart' => [
                'type'    => 'donut',
                'height'  => 280,
                'toolbar' => ['show' => false],
                'fontFamily' => 'Google Sans Flex, sans-serif',
            ],
            'series' => $values,
            'labels' => $labels,
            'colors' => $colors,
            'legend' => [
                'position'   => 'bottom',
                'fontSize'   => '12px',
                'fontWeight' => 600,
                'fontFamily' => 'Google Sans Flex, sans-serif',
                'itemMargin' => ['horizontal' => 8, 'vertical' => 4],
            ],
            'plotOptions' => [
                'pie' => [
                    'donut' => [
                        'size' => '65%',
                        'labels' => [
                            'show'  => true,
                            'total' => [
                                'show'      => true,
                                'label'     => 'Total Orders',
                                'fontSize'  => '13px',
                                'fontWeight'=> 700,
                                'color'     => '#374151',
                                'formatter' => "function(w){ return w.globals.seriesTotals.reduce(function(a,b){return a+b},0) }",
                            ],
                            'value' => [
                                'fontSize'   => '22px',
                                'fontWeight' => 800,
                                'color'      => '#0f172a',
                            ],
                        ],
                    ],
                ],
            ],
            'dataLabels' => ['enabled' => false],
            'stroke'     => ['width' => 2, 'colors' => ['#fff']],
            'tooltip'    => [
                'y' => [
                    'formatter' => "function(val){ return val + ' order' + (val !== 1 ? 's' : '') }",
                ],
            ],
        ];
    }
}
