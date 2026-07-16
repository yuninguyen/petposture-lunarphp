<?php

namespace App\Filament\Resources\OrderResource\Pages;

use App\Filament\Resources\OrderResource;
use Filament\Infolists;
use Filament\Infolists\Infolist;
use Filament\Resources\Pages\ViewRecord;

class ViewOrder extends ViewRecord
{
    protected static string $resource = OrderResource::class;

    public function infolist(Infolist $infolist): Infolist
    {
        return $infolist->schema([

            Infolists\Components\Section::make(__('Order Summary'))
                ->schema([
                    Infolists\Components\TextEntry::make('reference')
                        ->label(__('Reference')),
                    Infolists\Components\TextEntry::make('status')
                        ->label(__('Status'))
                        ->badge()
                        ->formatStateUsing(fn(string $state): string => str($state)->headline()->toString()),
                    Infolists\Components\TextEntry::make('customer_reference')
                        ->label(__('Customer Email')),
                    Infolists\Components\TextEntry::make('created_at')
                        ->label(__('Date'))
                        ->dateTime(),
                ])->columns(2),

            Infolists\Components\Section::make(__('Financials'))
                ->schema([
                    Infolists\Components\TextEntry::make('sub_total')
                        ->label(__('Subtotal'))
                        ->formatStateUsing(fn($state) => '$' . number_format(($state->value ?? (int) $state) / 100, 2)),
                    Infolists\Components\TextEntry::make('discount_total')
                        ->label(__('Discount'))
                        ->formatStateUsing(fn($state) => '-$' . number_format(($state->value ?? (int) $state) / 100, 2)),
                    Infolists\Components\TextEntry::make('shipping_total')
                        ->label(__('Shipping'))
                        ->formatStateUsing(fn($state) => '$' . number_format(($state->value ?? (int) $state) / 100, 2)),
                    Infolists\Components\TextEntry::make('tax_total')
                        ->label(__('Tax'))
                        ->formatStateUsing(fn($state) => '$' . number_format(($state->value ?? (int) $state) / 100, 2)),
                    Infolists\Components\TextEntry::make('total')
                        ->label(__('Total'))
                        ->formatStateUsing(fn($state) => '$' . number_format(($state->value ?? (int) $state) / 100, 2))
                        ->weight('bold'),
                    Infolists\Components\TextEntry::make('meta.payment_method')
                        ->label(__('Payment Method'))
                        ->formatStateUsing(fn(?string $state): string => match ($state) {
                            'cod' => 'COD',
                            'card' => 'Credit Card',
                            'paypal' => 'PayPal',
                            default => $state ? str($state)->headline()->toString() : '—',
                        }),
                    Infolists\Components\TextEntry::make('meta.payment_status')
                        ->label(__('Payment Status'))
                        ->formatStateUsing(fn(?string $state): string => $state ? str($state)->headline()->toString() : '—'),
                    Infolists\Components\TextEntry::make('meta.coupon_code')
                        ->label(__('Coupon'))
                        ->default('—'),
                ])->columns(4),

            Infolists\Components\Section::make(__('Items'))
                ->schema([
                    Infolists\Components\RepeatableEntry::make('lines')
                        ->label('')
                        ->state(fn($record) => $record->lines->where('type', '!=', 'shipping')->values())
                        ->schema([
                            Infolists\Components\TextEntry::make('description')
                                ->label(__('Product')),
                            Infolists\Components\TextEntry::make('quantity')
                                ->label(__('Qty')),
                            Infolists\Components\TextEntry::make('unit_price')
                                ->label(__('Unit Price'))
                                ->formatStateUsing(fn($state) => '$' . number_format(($state->value ?? (int) $state) / 100, 2)),
                            Infolists\Components\TextEntry::make('sub_total')
                                ->label(__('Subtotal'))
                                ->formatStateUsing(fn($state) => '$' . number_format(($state->value ?? (int) $state) / 100, 2)),
                        ])
                        ->columns(4),
                ]),

            Infolists\Components\Grid::make(2)
                ->schema([
                    Infolists\Components\Section::make(__('Shipping Address'))
                        ->schema([
                            Infolists\Components\TextEntry::make('shippingAddress.first_name')
                                ->label(__('First Name')),
                            Infolists\Components\TextEntry::make('shippingAddress.last_name')
                                ->label(__('Last Name')),
                            Infolists\Components\TextEntry::make('shippingAddress.line_one')
                                ->label(__('Address')),
                            Infolists\Components\TextEntry::make('shippingAddress.city')
                                ->label(__('City')),
                            Infolists\Components\TextEntry::make('shippingAddress.state')
                                ->label(__('State')),
                            Infolists\Components\TextEntry::make('shippingAddress.postcode')
                                ->label(__('Postcode')),
                            Infolists\Components\TextEntry::make('shippingAddress.contact_phone')
                                ->label(__('Phone Number')),
                            Infolists\Components\TextEntry::make('shippingAddress.country.name')
                                ->label(__('Country')),
                        ])->columns(2),

                    Infolists\Components\Section::make(__('Billing Address'))
                        ->schema([
                            Infolists\Components\TextEntry::make('billingAddress.first_name')
                                ->label(__('First Name')),
                            Infolists\Components\TextEntry::make('billingAddress.last_name')
                                ->label(__('Last Name')),
                            Infolists\Components\TextEntry::make('billingAddress.line_one')
                                ->label(__('Address')),
                            Infolists\Components\TextEntry::make('billingAddress.city')
                                ->label(__('City')),
                            Infolists\Components\TextEntry::make('billingAddress.state')
                                ->label(__('State')),
                            Infolists\Components\TextEntry::make('billingAddress.postcode')
                                ->label(__('Postcode')),
                            Infolists\Components\TextEntry::make('billingAddress.contact_phone')
                                ->label(__('Phone Number')),
                            Infolists\Components\TextEntry::make('billingAddress.country.name')
                                ->label(__('Country')),
                        ])->columns(2),
                ]),

            Infolists\Components\Section::make(__('Notes'))
                ->schema([
                    Infolists\Components\TextEntry::make('notes')
                        ->label(__('Customer Note'))
                        ->default('—')
                        ->columnSpanFull(),
                    Infolists\Components\TextEntry::make('meta.internal_note')
                        ->label(__('Internal Note'))
                        ->default('—')
                        ->columnSpanFull(),
                ]),
        ]);
    }
}
