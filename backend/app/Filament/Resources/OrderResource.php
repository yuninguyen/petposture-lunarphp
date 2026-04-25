<?php

namespace App\Filament\Resources;

use App\Filament\Resources\OrderResource\Pages;
use Lunar\Models\Order;
use Filament\Forms;
use Filament\Forms\Form;
use Filament\Resources\Resource;
use Filament\Tables;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;

class OrderResource extends Resource
{
    protected static ?string $model = Order::class;

    protected static ?string $navigationIcon = 'heroicon-o-shopping-cart';

    public static function getNavigationGroup(): ?string
    {
        return __('Sales');
    }

    protected static ?string $recordTitleAttribute = 'reference';

    public static function getLabel(): string
    {
        return __('admin.orders.label');
    }

    public static function getPluralLabel(): string
    {
        return __('admin.orders.plural_label');
    }

    public static function form(Form $form): Form
    {
        return $form
            ->schema([
                Forms\Components\Group::make()
                    ->schema([
                        Forms\Components\Section::make(__('admin.orders.sections.summary'))
                            ->schema([
                                Forms\Components\TextInput::make('reference')
                                    ->label(__('Reference'))
                                    ->disabled(),
                                Forms\Components\TextInput::make('status')
                                    ->label(__('Status'))
                                    ->disabled(),
                                Forms\Components\TextInput::make('currency_code')
                                    ->label(__('admin.orders.fields.currency'))
                                    ->disabled(),
                                Forms\Components\TextInput::make('total')
                                    ->label(__('Total'))
                                    ->formatStateUsing(fn($state, $record) => number_format($state / 100, 2) . ' ' . $record->currency_code)
                                    ->disabled(),
                            ])->columns(2),

                        Forms\Components\Section::make(__('admin.orders.sections.customer'))
                            ->schema([
                                Forms\Components\Placeholder::make('customer')
                                    ->label(__('Customer'))
                                    ->content(fn($record) => $record?->customer?->first_name . ' ' . $record?->customer?->last_name),
                                Forms\Components\Placeholder::make('email')
                                    ->content(fn($record) => $record?->billingAddress?->contact_email),
                            ])->columns(2),
                    ])->columnSpan(['lg' => 2]),

                Forms\Components\Group::make()
                    ->schema([
                        Forms\Components\Section::make(__('admin.orders.sections.metadata'))
                            ->schema([
                                Forms\Components\Placeholder::make('created_at')
                                    ->label(__('admin.orders.fields.ordered_at'))
                                    ->content(fn($record): string => $record?->created_at ? $record->created_at->diffForHumans() : '-'),

                                Forms\Components\Placeholder::make('updated_at')
                                    ->label(__('Updated At'))
                                    ->content(fn($record): string => $record?->updated_at ? $record->updated_at->diffForHumans() : '-'),
                            ]),
                    ])->columnSpan(['lg' => 1]),
            ])->columns(3);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->columns([
                Tables\Columns\TextColumn::make('reference')
                    ->label(__('Reference'))
                    ->searchable()
                    ->sortable(),
                Tables\Columns\TextColumn::make('customer.first_name')
                    ->label(__('Customer'))
                    ->getStateUsing(fn($record) => $record->customer ? "{$record->customer->first_name} {$record->customer->last_name}" : 'Guest')
                    ->searchable(['first_name', 'last_name']),
                Tables\Columns\TextColumn::make('status')
                    ->label(__('Status'))
                    ->badge()
                    ->color(fn(string $state): string => match ($state) {
                        'completed' => 'success',
                        'awaiting-payment' => 'warning',
                        'cancelled' => 'danger',
                        'processing' => 'info',
                        default => 'gray',
                    })
                    ->formatStateUsing(fn($state) => __($state))
                    ->sortable(),
                Tables\Columns\TextColumn::make('total')
                    ->label(__('Total'))
                    ->formatStateUsing(fn($state, $record) => number_format($state / 100, 2) . ' ' . $record->currency_code)
                    ->sortable(),
                Tables\Columns\TextColumn::make('created_at')
                    ->dateTime()
                    ->sortable()
                    ->toggleable(isToggledHiddenByDefault: true),
            ])
            ->filters([
                Tables\Filters\SelectFilter::make('status')
                    ->options([
                        'awaiting-payment' => 'Awaiting Payment',
                        'paid' => 'Paid',
                        'processing' => 'Processing',
                        'shipped' => 'Shipped',
                        'delivered' => 'Delivered',
                        'cancelled' => 'Cancelled',
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
            OrderResource\RelationManagers\OrderLinesRelationManager::class,
        ];
    }

    public static function getPages(): array
    {
        return [
            'index' => Pages\ListOrders::route('/'),
            'create' => Pages\CreateOrder::route('/create'),
            'view' => Pages\ViewOrder::route('/{record}'),
            'edit' => Pages\EditOrder::route('/{record}/edit'),
        ];
    }
}
