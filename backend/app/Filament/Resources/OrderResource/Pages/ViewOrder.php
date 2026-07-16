<?php

namespace App\Filament\Resources\OrderResource\Pages;

use App\Filament\Resources\OrderResource;
use App\Services\OrderOperationsService;
use Filament\Actions;
use Filament\Infolists;
use Filament\Infolists\Infolist;
use Filament\Resources\Pages\ViewRecord;

class ViewOrder extends ViewRecord
{
    protected static string $resource = OrderResource::class;

    protected function getHeaderActions(): array
    {
        $operations = app(OrderOperationsService::class);

        return collect($operations->availableActions($this->record))
            ->map(function (array $action) use ($operations) {
                $isCancel = $action['action'] === 'cancelOrder';

                return Actions\Action::make($action['action'])
                    ->label($action['label'])
                    ->color($isCancel ? 'danger' : 'primary')
                    ->requiresConfirmation()
                    ->action(function () use ($operations, $action) {
                        $operations->performAction($this->record, $action['action']);

                        $this->redirect(static::getUrl(['record' => $this->record]));
                    });
            })
            ->all();
    }

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

            Infolists\Components\Grid::make(2)
                ->schema([
                    Infolists\Components\Section::make(__('Shipping Address'))
                        ->schema([
                            Infolists\Components\TextEntry::make('shipping_block')
                                ->label('')
                                ->html()
                                ->state(fn($record) => collect([
                                    trim(($record->shippingAddress?->first_name ?? '') . ' ' . ($record->shippingAddress?->last_name ?? '')),
                                    collect([
                                        $record->shippingAddress?->line_one,
                                        $record->shippingAddress?->city,
                                        trim(($record->shippingAddress?->state ?? '') . ' ' . ($record->shippingAddress?->postcode ?? '')),
                                        $record->shippingAddress?->country?->name,
                                    ])->filter()->implode(', '),
                                    $record->shippingAddress?->contact_phone,
                                ])->filter()->implode('<br>') ?: '—'),
                        ])->columnSpan(1),

                    Infolists\Components\Section::make(__('Billing Address'))
                        ->schema([
                            Infolists\Components\TextEntry::make('billing_block')
                                ->label('')
                                ->html()
                                ->state(fn($record) => collect([
                                    trim(($record->billingAddress?->first_name ?? '') . ' ' . ($record->billingAddress?->last_name ?? '')),
                                    collect([
                                        $record->billingAddress?->line_one,
                                        $record->billingAddress?->city,
                                        trim(($record->billingAddress?->state ?? '') . ' ' . ($record->billingAddress?->postcode ?? '')),
                                        $record->billingAddress?->country?->name,
                                    ])->filter()->implode(', '),
                                    $record->billingAddress?->contact_phone,
                                ])->filter()->implode('<br>') ?: '—'),
                        ])->columnSpan(1),
                ]),

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
                        ->columns(4)
                        ->columnSpanFull(),

                    Infolists\Components\TextEntry::make('sub_total')
                        ->label(__('Items Subtotal'))
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
                        ->label(__('Order Total'))
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
