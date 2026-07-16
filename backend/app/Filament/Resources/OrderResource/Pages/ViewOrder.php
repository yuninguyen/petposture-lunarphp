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

                    Infolists\Components\TextEntry::make('totals_block')
                        ->label('')
                        ->alignEnd()
                        ->html()
                        ->columnSpanFull()
                        ->state(function ($record) {
                            $money = fn($state) => '$' . number_format(($state->value ?? (int) $state) / 100, 2);
                            $discount = (int) ($record->discount_total->value ?? $record->discount_total ?? 0);

                            $rows = [
                                'Items Subtotal: ' . $money($record->sub_total),
                            ];

                            if ($discount > 0) {
                                $rows[] = 'Discount: -' . $money($record->discount_total);
                            }

                            $rows[] = 'Shipping: ' . $money($record->shipping_total);
                            $rows[] = 'Tax: ' . $money($record->tax_total);
                            $rows[] = '<strong>Order Total: ' . $money($record->total) . '</strong>';
                            $rows[] = '<hr style="margin: 8px 0; border-color: rgb(228 228 231);">';

                            $paymentMethod = match ($record->meta['payment_method'] ?? null) {
                                'cod' => 'COD',
                                'card' => 'Credit Card',
                                'paypal' => 'PayPal',
                                default => $record->meta['payment_method'] ?? null
                                    ? str($record->meta['payment_method'])->headline()->toString()
                                    : '—',
                            };
                            $paymentStatus = ($record->meta['payment_status'] ?? null)
                                ? str($record->meta['payment_status'])->headline()->toString()
                                : '—';

                            $rows[] = "Payment Method: {$paymentMethod}";
                            $rows[] = "Payment Status: {$paymentStatus}";

                            if ($couponCode = $record->meta['coupon_code'] ?? null) {
                                $rows[] = "Coupon: {$couponCode}";
                            }

                            return implode('<br>', $rows);
                        }),
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
