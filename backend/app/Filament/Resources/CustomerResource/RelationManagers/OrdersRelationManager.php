<?php

namespace App\Filament\Resources\CustomerResource\RelationManagers;

use App\Filament\Resources\OrderResource\Pages\ViewOrder;
use Filament\Tables;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;
use Lunar\Admin\Filament\Resources\CustomerResource\RelationManagers\OrdersRelationManager as BaseOrdersRelationManager;
use Lunar\Models\Contracts\Order as OrderContract;

class OrdersRelationManager extends BaseOrdersRelationManager
{
    public function getDefaultTable(Table $table): Table
    {
        return $table->columns([
            Tables\Columns\TextColumn::make('created_at')
                ->label(__('Date'))
                ->dateTime()
                ->sortable(),
            Tables\Columns\TextColumn::make('reference')
                ->label(__('Order #'))
                ->searchable()
                ->sortable(),
            Tables\Columns\TextColumn::make('customer_name')
                ->label(__('Customer'))
                ->getStateUsing(fn ($record) => trim(($record->shippingAddress?->first_name ?? '').' '.($record->shippingAddress?->last_name ?? '')) ?: '—'),
            Tables\Columns\TextColumn::make('status')
                ->label(__('Order Status'))
                ->badge()
                ->formatStateUsing(fn (string $state): string => str($state)->headline()->toString())
                ->color(fn ($state) => match (true) {
                    \in_array($state, ['awaiting-payment', 'payment-offline']) => 'warning',
                    $state === 'cancelled' => 'danger',
                    \in_array($state, ['payment-received', 'processing', 'shipped']) => 'info',
                    $state === 'delivered' => 'success',
                    default => 'gray',
                }),
            Tables\Columns\TextColumn::make('total')
                ->label(__('Total'))
                ->formatStateUsing(fn ($state) => '$'.number_format(($state->value ?? (int) $state) / 100, 2))
                ->sortable(),
        ])->modifyQueryUsing(
            fn (Builder $query): Builder => $query->with(['currency'])
        )->defaultSort('created_at', 'desc')
            ->actions([
                Tables\Actions\Action::make('viewOrder')
                    ->label(__('View'))
                    ->icon('heroicon-o-eye')
                    ->url(fn (OrderContract $record): string => ViewOrder::getUrl(['record' => $record])),
            ]);
    }
}
