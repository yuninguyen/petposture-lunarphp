<?php

namespace App\Filament\Widgets;

use App\Models\Order;
use App\Models\Product;
use App\Models\User;
use Filament\Widgets\StatsOverviewWidget as BaseWidget;
use Filament\Widgets\StatsOverviewWidget\Stat;

class EcommerceStatsOverview extends BaseWidget
{
    protected function getStats(): array
    {
        return [
            Stat::make('TOTAL REVENUE', '$' . number_format(Order::where('status', '!=', 'CANCELLED')->sum('total_amount'), 2))
                ->description('SALES VOLUME')
                ->color('primary'),
            Stat::make('TOTAL ORDERS', Order::count())
                ->description('LIFETIME TRANSACTIONS'),
            Stat::make('ACTIVE PRODUCTS', Product::where('is_active', true)->count())
                ->description('READY FOR DISPATCH'),
        ];
    }
}
