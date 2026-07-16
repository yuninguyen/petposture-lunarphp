<?php

namespace App\Filament\Resources\CustomerResource\RelationManagers;

use App\Filament\Resources\OrderResource\Pages\ViewOrder;
use Filament\Tables;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;
use Lunar\Admin\Filament\Resources\CustomerResource\RelationManagers\OrdersRelationManager as BaseOrdersRelationManager;
use Lunar\Admin\Filament\Resources\OrderResource;
use Lunar\Models\Contracts\Order as OrderContract;

class OrdersRelationManager extends BaseOrdersRelationManager
{
    public function getDefaultTable(Table $table): Table
    {
        return $table->columns(
            OrderResource::getTableColumns()
        )->modifyQueryUsing(
            fn (Builder $query): Builder => $query->with(['currency'])
        )->actions([
            Tables\Actions\Action::make('viewOrder')
                ->url(fn (OrderContract $record): string => ViewOrder::getUrl(['record' => $record])),
        ]);
    }
}
