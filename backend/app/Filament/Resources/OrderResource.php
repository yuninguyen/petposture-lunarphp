<?php

namespace App\Filament\Resources;

use App\Filament\Resources\OrderResource\Pages\CreateOrder;
use App\Filament\Resources\OrderResource\Pages\ListOrders;
use App\Filament\Resources\OrderResource\Pages\ViewOrder;
use Filament\Forms;
use Filament\Forms\Form;
use Filament\Forms\Get;
use Filament\Resources\Resource;
use Filament\Tables;
use Filament\Tables\Table;
use Lunar\Models\Order;
use Lunar\Models\ProductVariant;

class OrderResource extends Resource
{
    protected static ?string $model = Order::class;

    protected static ?string $navigationIcon = 'heroicon-o-shopping-bag';

    protected static ?int $navigationSort = 1;

    public static function getNavigationGroup(): ?string
    {
        return __('lunarpanel::global.sections.sales');
    }

    public static function getLabel(): string
    {
        return __('Order');
    }

    public static function getPluralLabel(): string
    {
        return __('Orders');
    }

    public static function form(Form $form): Form
    {
        return $form->schema([

            Forms\Components\Section::make(__('Customer'))
                ->schema([
                    Forms\Components\TextInput::make('email')
                        ->label(__('Email'))
                        ->email()
                        ->required()
                        ->maxLength(255),
                    Forms\Components\TextInput::make('first_name')
                        ->label(__('First Name'))
                        ->required()
                        ->maxLength(255),
                    Forms\Components\TextInput::make('last_name')
                        ->label(__('Last Name'))
                        ->maxLength(255),
                    Forms\Components\TextInput::make('phone')
                        ->label(__('Phone'))
                        ->tel()
                        ->maxLength(50),
                ])->columns(2),

            Forms\Components\Section::make(__('Items'))
                ->schema([
                    Forms\Components\Repeater::make('items')
                        ->label('')
                        ->schema([
                            Forms\Components\Select::make('variant_id')
                                ->label(__('Product'))
                                ->options(function () {
                                    return ProductVariant::with(['product', 'prices'])
                                        ->get()
                                        ->mapWithKeys(function ($variant) {
                                            $name = $variant->product?->translateAttribute('name') ?? 'Product';
                                            $sku = $variant->sku ? " [{$variant->sku}]" : '';
                                            return [$variant->id => $name . $sku];
                                        });
                                })
                                ->searchable()
                                ->required()
                                ->reactive()
                                ->afterStateUpdated(function ($state, Forms\Set $set) {
                                    if (!$state) return;
                                    $variant = ProductVariant::with(['prices.currency'])->find($state);
                                    $price = $variant?->prices->sortBy('min_quantity')->first();
                                    $amount = $price ? ($price->price->value ?? $price->price) / 100 : 0;
                                    $set('unit_price', number_format((float) $amount, 2, '.', ''));
                                })
                                ->columnSpan(2),
                            Forms\Components\TextInput::make('quantity')
                                ->label(__('Qty'))
                                ->numeric()
                                ->default(1)
                                ->minValue(1)
                                ->required(),
                            Forms\Components\TextInput::make('unit_price')
                                ->label(__('Unit Price ($)'))
                                ->numeric()
                                ->prefix('$')
                                ->readOnly(),
                        ])
                        ->columns(4)
                        ->minItems(1)
                        ->addActionLabel(__('Add Item')),
                ]),

            Forms\Components\Section::make(__('Shipping Address'))
                ->schema([
                    Forms\Components\TextInput::make('shipping_first_name')
                        ->label(__('First Name'))
                        ->required()
                        ->maxLength(255),
                    Forms\Components\TextInput::make('shipping_last_name')
                        ->label(__('Last Name'))
                        ->maxLength(255),
                    Forms\Components\TextInput::make('line_one')
                        ->label(__('Address Line 1'))
                        ->required()
                        ->maxLength(255)
                        ->columnSpanFull(),
                    Forms\Components\TextInput::make('line_two')
                        ->label(__('Address Line 2'))
                        ->maxLength(255)
                        ->columnSpanFull(),
                    Forms\Components\TextInput::make('city')
                        ->label(__('City'))
                        ->required()
                        ->maxLength(100),
                    Forms\Components\TextInput::make('state')
                        ->label(__('State'))
                        ->maxLength(100),
                    Forms\Components\TextInput::make('postcode')
                        ->label(__('Postcode'))
                        ->maxLength(20),
                    Forms\Components\TextInput::make('country')
                        ->label(__('Country'))
                        ->default('US')
                        ->maxLength(10),
                ])->columns(2),

            Forms\Components\Section::make(__('Billing Address'))
                ->schema([
                    Forms\Components\Toggle::make('billing_same_as_shipping')
                        ->label(__('Same as shipping address'))
                        ->default(true)
                        ->reactive()
                        ->columnSpanFull(),
                    Forms\Components\TextInput::make('billing_first_name')
                        ->label(__('First Name'))
                        ->maxLength(255)
                        ->hidden(fn(Get $get) => $get('billing_same_as_shipping')),
                    Forms\Components\TextInput::make('billing_last_name')
                        ->label(__('Last Name'))
                        ->maxLength(255)
                        ->hidden(fn(Get $get) => $get('billing_same_as_shipping')),
                    Forms\Components\TextInput::make('billing_line_one')
                        ->label(__('Address Line 1'))
                        ->maxLength(255)
                        ->columnSpanFull()
                        ->hidden(fn(Get $get) => $get('billing_same_as_shipping')),
                    Forms\Components\TextInput::make('billing_line_two')
                        ->label(__('Address Line 2'))
                        ->maxLength(255)
                        ->columnSpanFull()
                        ->hidden(fn(Get $get) => $get('billing_same_as_shipping')),
                    Forms\Components\TextInput::make('billing_city')
                        ->label(__('City'))
                        ->maxLength(100)
                        ->hidden(fn(Get $get) => $get('billing_same_as_shipping')),
                    Forms\Components\TextInput::make('billing_state')
                        ->label(__('State'))
                        ->maxLength(100)
                        ->hidden(fn(Get $get) => $get('billing_same_as_shipping')),
                    Forms\Components\TextInput::make('billing_postcode')
                        ->label(__('Postcode'))
                        ->maxLength(20)
                        ->hidden(fn(Get $get) => $get('billing_same_as_shipping')),
                    Forms\Components\TextInput::make('billing_country')
                        ->label(__('Country'))
                        ->default('US')
                        ->maxLength(10)
                        ->hidden(fn(Get $get) => $get('billing_same_as_shipping')),
                ])->columns(2),

            Forms\Components\Section::make(__('Order Settings'))
                ->schema([
                    Forms\Components\Select::make('payment_method')
                        ->label(__('Payment Method'))
                        ->options([
                            'cod'  => __('Cash on Delivery'),
                            'card' => __('Credit Card (Paid)'),
                        ])
                        ->default('cod')
                        ->required(),
                    Forms\Components\Select::make('shipping_method')
                        ->label(__('Shipping Method'))
                        ->options([
                            'standard' => __('Standard'),
                            'express'  => __('Express'),
                        ])
                        ->default('standard')
                        ->required(),
                    Forms\Components\TextInput::make('shipping_fee_override')
                        ->label(__('Shipping Fee Override ($)'))
                        ->helperText(__('Leave blank to use calculated rate. Set 0 for free shipping.'))
                        ->numeric()
                        ->prefix('$')
                        ->minValue(0),
                    Forms\Components\TextInput::make('coupon_code')
                        ->label(__('Coupon Code'))
                        ->maxLength(100),
                ])->columns(2),

            Forms\Components\Section::make(__('Notes'))
                ->schema([
                    Forms\Components\Textarea::make('customer_note')
                        ->label(__('Customer Note'))
                        ->rows(3)
                        ->columnSpanFull(),
                    Forms\Components\Textarea::make('internal_note')
                        ->label(__('Internal Note'))
                        ->rows(3)
                        ->columnSpanFull(),
                ]),
        ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->columns([
                Tables\Columns\TextColumn::make('reference')
                    ->label(__('Reference'))
                    ->searchable()
                    ->sortable(),
                Tables\Columns\TextColumn::make('customer_reference')
                    ->label(__('Customer Email'))
                    ->searchable(),
                Tables\Columns\TextColumn::make('total')
                    ->label(__('Total'))
                    ->formatStateUsing(fn($state) => '$' . number_format(($state->value ?? (int) $state) / 100, 2))
                    ->sortable(),
                Tables\Columns\TextColumn::make('status')
                    ->label(__('Status'))
                    ->badge()
                    ->color(fn($state) => match(true) {
                        $state === 'payment-pending'  => 'warning',
                        $state === 'cancelled'        => 'danger',
                        \in_array($state, ['payment-received', 'dispatched', 'delivered']) => 'success',
                        default => 'gray',
                    }),
                Tables\Columns\TextColumn::make('meta.payment_method')
                    ->label(__('Payment'))
                    ->default('—'),
                Tables\Columns\TextColumn::make('created_at')
                    ->label(__('Date'))
                    ->dateTime()
                    ->sortable(),
            ])
            ->defaultSort('created_at', 'desc')
            ->actions([
                Tables\Actions\ViewAction::make(),
            ]);
    }

    public static function getPages(): array
    {
        return [
            'index'  => ListOrders::route('/'),
            'create' => CreateOrder::route('/create'),
            'view'   => ViewOrder::route('/{record}'),
        ];
    }
}
