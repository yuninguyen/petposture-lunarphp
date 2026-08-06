<?php

namespace App\Filament\Resources\OrderResource\Pages;

use App\Filament\Resources\OrderResource;
use Filament\Actions;
use Filament\Resources\Components\Tab;
use Filament\Resources\Pages\ListRecords;
use Illuminate\Database\Eloquent\Builder;
use Lunar\Models\Order;

class ListOrders extends ListRecords
{
    protected static string $resource = OrderResource::class;

    protected function getHeaderActions(): array
    {
        return [
            Actions\CreateAction::make()->label(__('New Manual Order')),
        ];
    }

    public function getTabs(): array
    {
        $statuses = [
            'awaiting-payment' => __('admin.orders.statuses.awaiting-payment'),
            'processing' => __('admin.orders.statuses.processing'),
            'shipped' => __('admin.orders.statuses.shipped'),
            'delivered' => __('admin.orders.statuses.delivered'),
            'cancelled' => __('admin.orders.statuses.cancelled'),
        ];

        $tabs = ['all' => Tab::make(__('All'))];

        foreach ($statuses as $status => $label) {
            $tabs[$status] = Tab::make($label)
                ->modifyQueryUsing(fn (Builder $query) => $query->where('status', $status))
                ->badge(Order::where('status', $status)->count());
        }

        return $tabs;
    }
}
