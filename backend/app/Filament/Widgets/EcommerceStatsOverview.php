<?php

namespace App\Filament\Widgets;

use App\Models\User;
use Filament\Widgets\StatsOverviewWidget as BaseWidget;
use Filament\Widgets\StatsOverviewWidget\Stat;
use Lunar\Models\Order;
use Lunar\Models\Product;

class EcommerceStatsOverview extends BaseWidget
{
    protected function getStats(): array
    {
        $revenue = Order::whereNotIn('status', ['cancelled'])->sum('total');

        return [
            Stat::make('Total Revenue', '$' . number_format($revenue / 100, 2))
                ->description('All time, excluding cancelled')
                ->color('primary'),
            Stat::make('Total Orders', Order::count())
                ->description('Lifetime transactions'),
            Stat::make('Active Products', Product::where('status', 'published')->count())
                ->description('Published in catalogue'),
            Stat::make('Customers', User::role('customer')->count())
                ->description('Registered customers'),
        ];
    }
}
