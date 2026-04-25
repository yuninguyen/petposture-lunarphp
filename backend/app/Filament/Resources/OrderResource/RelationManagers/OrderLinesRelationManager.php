<?php

namespace App\Filament\Resources\OrderResource\RelationManagers;

use Filament\Forms;
use Filament\Forms\Form;
use Filament\Resources\RelationManagers\RelationManager;
use Filament\Tables;
use Filament\Tables\Table;

class OrderLinesRelationManager extends RelationManager
{
    protected static string $relationship = 'lines';

    protected static ?string $recordTitleAttribute = 'description';

    public function form(Form $form): Form
    {
        return $form
            ->schema([
                Forms\Components\TextInput::make('description')
                    ->required()
                    ->maxLength(255),
                Forms\Components\TextInput::make('quantity')
                    ->required()
                    ->numeric(),
                Forms\Components\TextInput::make('unit_price')
                    ->required()
                    ->numeric(),
            ]);
    }

    public function table(Table $table): Table
    {
        return $table
            ->columns([
                Tables\Columns\ImageColumn::make('purchasable.thumbnail')
                    ->label('')
                    ->disk('public'),
                Tables\Columns\TextColumn::make('description')
                    ->label('Product'),
                Tables\Columns\TextColumn::make('identifier')
                    ->label('SKU'),
                Tables\Columns\TextColumn::make('quantity')
                    ->label('Qty'),
                Tables\Columns\TextColumn::make('unit_price')
                    ->label('Price')
                    ->formatStateUsing(fn($state, $record) => number_format($state / 100, 2) . ' ' . $record->order->currency_code),
                Tables\Columns\TextColumn::make('sub_total')
                    ->label('Sub-total')
                    ->formatStateUsing(fn($state, $record) => number_format($state / 100, 2) . ' ' . $record->order->currency_code),
            ])
            ->filters([
                //
            ])
            ->headerActions([
                // Manual additions usually handled by cart actions
            ])
            ->actions([
                // Tables\Actions\EditAction::make(),
            ])
            ->bulkActions([
                //
            ]);
    }
}
