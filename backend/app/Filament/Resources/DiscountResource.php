<?php

namespace App\Filament\Resources;

use App\Filament\Resources\DiscountResource\Pages;
use App\Models\Discount;
use Filament\Forms;
use Filament\Forms\Form;
use Filament\Resources\Resource;
use Filament\Tables;
use Filament\Tables\Table;
use Illuminate\Support\Str;
use Lunar\Models\Currency;

class DiscountResource extends Resource
{
    protected static ?string $model = Discount::class;

    protected static ?string $navigationLabel = 'Coupons';

    protected static ?string $pluralLabel = 'Coupons';

    protected static ?string $modelLabel = 'Coupon';

    protected static ?string $navigationIcon = 'heroicon-o-ticket';

    protected static ?int $navigationSort = 5;

    public static function getNavigationGroup(): ?string
    {
        return __('Ecommerce');
    }

    public static function form(Form $form): Form
    {
        return $form
            ->schema([
                Forms\Components\Group::make()
                    ->schema([
                        Forms\Components\Section::make()
                            ->schema([
                                Forms\Components\TextInput::make('coupon')
                                    ->label(__('Coupon code'))
                                    ->required()
                                    ->unique(ignoreRecord: true)
                                    ->suffixAction(
                                        Forms\Components\Actions\Action::make('generateCode')
                                            ->icon('heroicon-m-arrow-path')
                                            ->action(function (Forms\Set $set) {
                                                $set('coupon', strtoupper(Str::random(8)));
                                            })
                                    ),
                                Forms\Components\Textarea::make('name')
                                    ->label(__('Description (optional)'))
                                    ->rows(3),
                            ]),

                        Forms\Components\Tabs::make('Coupon data')
                            ->tabs([
                                Forms\Components\Tabs\Tab::make(__('General'))
                                    ->schema([
                                        Forms\Components\Select::make('discount_type_select')
                                            ->label(__('Discount type'))
                                            ->options([
                                                'percentage' => __('Percentage discount'),
                                                'fixed_cart' => __('Fixed cart discount'),
                                                'fixed_product' => __('Fixed product discount'),
                                            ])
                                            ->required()
                                            ->live()
                                            ->afterStateHydrated(function ($state, $record, Forms\Set $set) {
                                                if (!$record)
                                                    return;

                                                if ($record->type === \Lunar\DiscountTypes\AmountOff::class) {
                                                    $set('discount_type_select', ($record->data['fixed_value'] ?? false) ? 'fixed_cart' : 'percentage');
                                                } elseif ($record->type === \App\Lunar\DiscountTypes\FixedAmountOffPerUnit::class) {
                                                    $set('discount_type_select', 'fixed_product');
                                                }
                                            }),

                                        Forms\Components\TextInput::make('amount')
                                            ->label(__('Coupon amount'))
                                            ->numeric()
                                            ->required()
                                            ->helperText(__('For percentage, enter numbers like 10 for 10%.'))
                                            ->afterStateHydrated(function ($record, Forms\Set $set) {
                                                if (!$record)
                                                    return;
                                                $data = $record->data;
                                                if ($record->type === \Lunar\DiscountTypes\AmountOff::class && !($data['fixed_value'] ?? false)) {
                                                    $set('amount', $data['percentage'] ?? 0);
                                                } else {
                                                    $defaultCurrency = Currency::getDefault();
                                                    $amount = ($data['fixed_values'][$defaultCurrency->code] ?? 0) / $defaultCurrency->factor;
                                                    $set('amount', $amount);
                                                }
                                            }),

                                        Forms\Components\Checkbox::make('data.free_shipping')
                                            ->label(__('Allow free shipping'))
                                            ->helperText(__('Check this box if the coupon grants free shipping.')),

                                        Forms\Components\DatePicker::make('ends_at')
                                            ->label(__('Coupon expiry date'))
                                            ->placeholder('YYYY-MM-DD'),
                                    ]),

                                Forms\Components\Tabs\Tab::make(__('Usage restriction'))
                                    ->schema([
                                        Forms\Components\TextInput::make('data.min_prices.USD')
                                            ->label(__('Minimum spend'))
                                            ->numeric()
                                            ->prefix('$')
                                            ->helperText(__('Minimum subtotal to allow coupon usage.')),

                                        Forms\Components\Select::make('collections')
                                            ->multiple()
                                            ->relationship('collections', 'attribute_data')
                                            ->getOptionLabelFromRecordUsing(fn($record) => $record->translateAttribute('name'))
                                            ->preload()
                                            ->label(__('Product categories')),

                                        Forms\Components\Select::make('products')
                                            ->multiple()
                                            ->relationship('discountables', 'discountable_id')
                                            ->getOptionLabelFromRecordUsing(function ($record) {
                                                return $record->discountable?->translateAttribute('name') ?? 'Product #' . $record->discountable_id;
                                            })
                                            ->preload()
                                            ->label(__('Products')),
                                    ]),

                                Forms\Components\Tabs\Tab::make(__('Usage limits'))
                                    ->schema([
                                        Forms\Components\TextInput::make('max_uses')
                                            ->label(__('Usage limit per coupon'))
                                            ->numeric()
                                            ->placeholder(__('Unlimited')),

                                        Forms\Components\TextInput::make('max_uses_per_user')
                                            ->label(__('Usage limit per user'))
                                            ->numeric()
                                            ->placeholder(__('Unlimited')),
                                    ]),
                            ]),
                    ])->columnSpanFull(),
            ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->columns([
                Tables\Columns\TextColumn::make('coupon')
                    ->label(__('Code'))
                    ->searchable()
                    ->weight('bold')
                    ->copyable(),
                Tables\Columns\TextColumn::make('type_label')
                    ->label(__('Coupon type'))
                    ->getStateUsing(function ($record) {
                        if ($record->type === \Lunar\DiscountTypes\AmountOff::class) {
                            return ($record->data['fixed_value'] ?? false) ? 'Fixed cart discount' : 'Percentage discount';
                        }
                        if ($record->type === \App\Lunar\DiscountTypes\FixedAmountOffPerUnit::class) {
                            return 'Fixed product discount';
                        }
                        return 'Other';
                    }),
                Tables\Columns\TextColumn::make('amount_label')
                    ->label(__('Coupon amount'))
                    ->getStateUsing(function ($record) {
                        $data = $record->data;
                        if ($record->type === \Lunar\DiscountTypes\AmountOff::class && !($data['fixed_value'] ?? false)) {
                            return ($data['percentage'] ?? 0) . '%';
                        }
                        $defaultCurrency = Currency::getDefault();
                        $amount = ($data['fixed_values'][$defaultCurrency->code] ?? 0) / $defaultCurrency->factor;
                        return '$' . number_format($amount, 2);
                    }),
                Tables\Columns\TextColumn::make('name')
                    ->label(__('Description'))
                    ->limit(30)
                    ->copyable(),
                Tables\Columns\TextColumn::make('uses')
                    ->label(__('Usage / Limit'))
                    ->formatStateUsing(fn($state, $record) => "{$state} / " . ($record->max_uses ?? '∞')),
                Tables\Columns\TextColumn::make('ends_at')
                    ->label(__('Expiry date'))
                    ->date()
                    ->placeholder('-'),
            ])
            ->filters([
                //
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
            'index' => Pages\ListDiscounts::route('/'),
            'create' => Pages\CreateDiscount::route('/create'),
            'edit' => Pages\EditDiscount::route('/{record}/edit'),
        ];
    }
}
