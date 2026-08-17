<?php

namespace App\Filament\Widgets;

use Filament\Widgets\Concerns\InteractsWithPageFilters;
use Filament\Widgets\Widget;
use Lunar\Models\Order;

class OrderPipelineWidget extends Widget
{
    use InteractsWithPageFilters;

    protected static string $view = 'filament.widgets.order-pipeline';

    protected static ?int $sort = 4;

    protected int|string|array $columnSpan = 'full';

    protected function getViewData(): array
    {
        $rangeDays = match ($this->filters['range'] ?? '30') {
            '7' => 7,
            '30' => 30,
            '90' => 90,
            '365' => 365,
            default => null,
        };

        $stages = [
            'awaiting-payment' => [
                'label' => __('admin.orders.statuses.awaiting-payment'),
                'icon' => 'heroicon-o-clock',
                'color' => '#f59e0b',
            ],
            'processing' => [
                'label' => __('admin.orders.statuses.processing'),
                'icon' => 'heroicon-o-cog-6-tooth',
                'color' => '#3b82f6',
            ],
            'shipped' => [
                'label' => __('admin.orders.statuses.shipped'),
                'icon' => 'heroicon-o-truck',
                'color' => '#8b5cf6',
            ],
            'delivered' => [
                'label' => __('admin.orders.statuses.delivered'),
                'icon' => 'heroicon-o-check-circle',
                'color' => '#10b981',
            ],
        ];

        foreach ($stages as $status => &$stage) {
            $stage['count'] = Order::where('status', $status)
                ->when($rangeDays, fn ($query) => $query->where('created_at', '>=', now()->subDays($rangeDays)))
                ->count();
        }

        return [
            'heading' => __('admin.dashboard.order_status'),
            'stages' => $stages,
        ];
    }
}
