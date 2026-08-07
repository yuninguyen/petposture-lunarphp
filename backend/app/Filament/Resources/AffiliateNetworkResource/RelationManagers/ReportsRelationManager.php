<?php

namespace App\Filament\Resources\AffiliateNetworkResource\RelationManagers;

use Filament\Resources\RelationManagers\RelationManager;
use Filament\Tables;
use Filament\Tables\Table;

class ReportsRelationManager extends RelationManager
{
    protected static string $relationship = 'reports';

    protected static ?string $title = 'Sync History';

    public function table(Table $table): Table
    {
        return $table
            ->recordTitleAttribute('date')
            ->columns([
                Tables\Columns\TextColumn::make('date')
                    ->date()
                    ->sortable(),
                Tables\Columns\TextColumn::make('clicks')
                    ->numeric()
                    ->sortable(),
                Tables\Columns\TextColumn::make('conversions')
                    ->numeric()
                    ->sortable(),
                Tables\Columns\TextColumn::make('commission_amount')
                    ->label('Commission')
                    ->money('usd')
                    ->sortable(),
                Tables\Columns\TextColumn::make('synced_at')
                    ->since()
                    ->label('Synced'),
            ])
            ->defaultSort('date', 'desc')
            ->headerActions([])
            ->actions([])
            ->bulkActions([]);
    }
}
