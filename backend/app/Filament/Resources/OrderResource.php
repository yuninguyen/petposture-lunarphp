<?php

namespace App\Filament\Resources;

use App\Filament\Resources\OrderResource\Pages;
use App\Models\Order;
use Filament\Forms;
use Filament\Forms\Form;
use Filament\Resources\Resource;
use Filament\Tables;
use Filament\Tables\Table;

class OrderResource extends Resource
{
    protected static ?string $model = Order::class;

    protected static ?string $navigationIcon = 'heroicon-o-shopping-cart';

    protected static ?string $navigationGroup = 'Ecommerce';

    public static function form(Form $form): Form
    {
        return $form
            ->schema([
                Forms\Components\Select::make('user_id')
                    ->relationship('user', 'name')
                    ->disabled(),
                Forms\Components\TextInput::make('total_amount')
                    ->numeric()
                    ->prefix('$')
                    ->disabled(),
                Forms\Components\Select::make('status')
                    ->options([
                        'PENDING' => 'Pending',
                        'PAID' => 'Paid',
                        'SHIPPED' => 'Shipped',
                        'COMPLETED' => 'Completed',
                        'CANCELLED' => 'Cancelled',
                    ])
                    ->required(),
                Forms\Components\TextInput::make('payment_method')
                    ->disabled(),
                Forms\Components\Textarea::make('shipping_address')
                    ->disabled()
                    ->columnSpanFull(),
            ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->columns([
                Tables\Columns\TextColumn::make('id')
                    ->label('Order ID')
                    ->sortable(),
                Tables\Columns\TextColumn::make('user.name')
                    ->label('Customer')
                    ->sortable(),
                Tables\Columns\TextColumn::make('total_amount')
                    ->money()
                    ->sortable(),
                Tables\Columns\SelectColumn::make('status')
                    ->options([
                        'PENDING' => 'Pending',
                        'PAID' => 'Paid',
                        'SHIPPED' => 'Shipped',
                        'COMPLETED' => 'Completed',
                        'CANCELLED' => 'Cancelled',
                    ]),
                Tables\Columns\TextColumn::make('created_at')
                    ->dateTime()
                    ->sortable(),
            ])
            ->filters([
                Tables\Filters\SelectFilter::make('status')
                    ->options([
                        'PENDING' => 'Pending',
                        'PAID' => 'Paid',
                        'SHIPPED' => 'Shipped',
                    ]),
            ])
            ->actions([
                Tables\Actions\ViewAction::make(),
                Tables\Actions\EditAction::make(),
            ])
            ->bulkActions([
                Tables\Actions\BulkActionGroup::make([
                    Tables\Actions\DeleteBulkAction::make(),
                ]),
            ]);
    }

    public static function getRelations(): array
    {
        return [
            //
        ];
    }

    public static function getPages(): array
    {
        return [
            'index' => Pages\ListOrders::route('/'),
            'view' => Pages\ViewOrder::route('/{record}'),
            'edit' => Pages\EditOrder::route('/{record}/edit'),
        ];
    }
}
