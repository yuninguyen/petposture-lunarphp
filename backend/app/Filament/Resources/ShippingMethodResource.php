<?php

namespace App\Filament\Resources;

use App\Filament\Resources\ShippingMethodResource\Pages;
use App\Models\ShippingMethod;
use Filament\Forms;
use Filament\Forms\Form;
use Filament\Resources\Resource;
use Filament\Tables;
use Filament\Tables\Table;

class ShippingMethodResource extends Resource
{
    protected static ?string $model = ShippingMethod::class;

    protected static ?string $navigationIcon = 'heroicon-o-truck';

    protected static ?int $navigationSort = 2;

    public static function getNavigationGroup(): ?string
    {
        return __('lunarpanel::global.sections.sales');
    }

    public static function getLabel(): string
    {
        return __('Shipping Cost');
    }

    public static function getPluralLabel(): string
    {
        return __('Shipping Costs');
    }

    public static function form(Form $form): Form
    {
        return $form
            ->schema([
                Forms\Components\TextInput::make('code')
                    ->label(__('Code'))
                    ->required()
                    ->alphaDash()
                    ->unique(ignoreRecord: true)
                    ->disabled(fn(string $operation) => $operation === 'edit')
                    ->helperText(__('Used internally to match checkout selections. Cannot be changed after creation.')),
                Forms\Components\TextInput::make('name')
                    ->label(__('Name'))
                    ->required(),
                Forms\Components\TextInput::make('eta')
                    ->label(__('Delivery Estimate'))
                    ->placeholder('5-7 business days'),
                Forms\Components\TextInput::make('price')
                    ->label(__('Shipping Price'))
                    ->prefix('$')
                    ->numeric()
                    ->minValue(0)
                    ->required(),
                Forms\Components\TextInput::make('free_over')
                    ->label(__('Free Shipping Over'))
                    ->prefix('$')
                    ->numeric()
                    ->minValue(0)
                    ->nullable()
                    ->helperText(__('Order subtotal at which this becomes free. Leave blank to disable.')),
            ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->columns([
                Tables\Columns\TextColumn::make('code')
                    ->label(__('Code')),
                Tables\Columns\TextColumn::make('name')
                    ->label(__('Name')),
                Tables\Columns\TextColumn::make('eta')
                    ->label(__('Delivery Estimate')),
                Tables\Columns\TextColumn::make('price')
                    ->label(__('Price'))
                    ->money('usd'),
                Tables\Columns\TextColumn::make('free_over')
                    ->label(__('Free Shipping Over'))
                    ->money('usd')
                    ->placeholder('—'),
            ])
            ->actions([
                Tables\Actions\EditAction::make(),
                Tables\Actions\DeleteAction::make(),
            ])
            ->bulkActions([
                Tables\Actions\BulkActionGroup::make([
                    Tables\Actions\DeleteBulkAction::make(),
                ]),
            ]);
    }

    public static function getPages(): array
    {
        return [
            'index'  => Pages\ListShippingMethods::route('/'),
            'create' => Pages\CreateShippingMethod::route('/create'),
            'edit'   => Pages\EditShippingMethod::route('/{record}/edit'),
        ];
    }
}
