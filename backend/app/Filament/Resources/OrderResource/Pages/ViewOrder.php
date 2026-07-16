<?php

namespace App\Filament\Resources\OrderResource\Pages;

use App\Filament\Resources\OrderResource;
use App\Services\OrderEventService;
use App\Services\OrderOperationsService;
use Filament\Actions;
use Filament\Forms;
use Filament\Infolists;
use Filament\Infolists\Infolist;
use Filament\Resources\Pages\ViewRecord;

class ViewOrder extends ViewRecord
{
    protected static string $resource = OrderResource::class;

    protected function getHeaderActions(): array
    {
        $operations = app(OrderOperationsService::class);

        $actions = collect($operations->availableActions($this->record))
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

        $meta = (array) ($this->record->meta ?? []);
        $isRefundable = filled($meta['payment_intent_id'] ?? null)
            && ($meta['payment_status'] ?? null) === 'paid'
            && ($meta['refund_status'] ?? null) !== 'refunded';

        if ($isRefundable) {
            $actions[] = Actions\Action::make('refund')
                ->label(__('Refund'))
                ->color('danger')
                ->form([
                    Forms\Components\TextInput::make('amount')
                        ->label(__('Amount (leave blank for full refund)'))
                        ->numeric()
                        ->prefix('$'),
                ])
                ->requiresConfirmation()
                ->action(function (array $data) {
                    $amountMinor = filled($data['amount'] ?? null)
                        ? (int) round(((float) $data['amount']) * 100)
                        : null;

                    app(OrderOperationsService::class)->refundOrder($this->record, $amountMinor);

                    $this->redirect(static::getUrl(['record' => $this->record]));
                });
        }

        $actions[] = Actions\Action::make('addNote')
            ->label(__('Add Note'))
            ->color('gray')
            ->form([
                Forms\Components\Textarea::make('note')
                    ->label(__('Note'))
                    ->required(),
            ])
            ->action(function (array $data) {
                app(OrderEventService::class)->record(
                    $this->record,
                    'note.private',
                    'Private note',
                    $data['note'],
                    dedupeAgainstLatest: false,
                );

                $this->redirect(static::getUrl(['record' => $this->record]));
            });

        return $actions;
    }

    public function infolist(Infolist $infolist): Infolist
    {
        return $infolist->schema([

            Infolists\Components\Grid::make(5)
                ->schema([
                    Infolists\Components\Section::make(__('Order Summary'))
                        ->schema([
                            Infolists\Components\TextEntry::make('reference')
                                ->label(__('Order Number'))
                                ->formatStateUsing(fn(string $state): string => "#{$state}"),
                            Infolists\Components\TextEntry::make('status')
                                ->label(__('Status'))
                                ->badge()
                                ->formatStateUsing(fn(string $state): string => str($state)->headline()->toString()),
                            Infolists\Components\TextEntry::make('customer_reference')
                                ->label(__('Customer Email')),
                            Infolists\Components\TextEntry::make('created_at')
                                ->label(__('Date'))
                                ->dateTime(),
                            Infolists\Components\TextEntry::make('meta.customer_ip')
                                ->label(__('Customer IP'))
                                ->default('—'),
                        ])->columns(2)->columnSpan(3),

                    Infolists\Components\Section::make(__('Order Attribution'))
                        ->schema([
                            Infolists\Components\TextEntry::make('meta.attribution_origin')
                                ->label(__('Origin'))
                                ->default('—'),
                            Infolists\Components\TextEntry::make('meta.attribution_device_type')
                                ->label(__('Device Type'))
                                ->default('—'),
                            Infolists\Components\TextEntry::make('meta.attribution_session_page_views')
                                ->label(__('Session Page Views'))
                                ->default('—'),
                        ])->columnSpan(2),
                ]),

            Infolists\Components\Section::make(__('Fraud & Risk'))
                ->description(__('Powered by Stripe Radar — automatic on every card payment, no extra setup required.'))
                ->visible(fn($record) => filled($record->meta['fraud_risk_level'] ?? null))
                ->schema([
                    Infolists\Components\TextEntry::make('meta.fraud_risk_level')
                        ->label(__('Risk Level'))
                        ->badge()
                        ->formatStateUsing(fn(?string $state): string => $state ? str($state)->headline()->toString() : '—')
                        ->color(fn(?string $state): string => match ($state) {
                            'highest' => 'danger',
                            'elevated' => 'warning',
                            default => 'success',
                        }),
                    Infolists\Components\TextEntry::make('meta.fraud_risk_score')
                        ->label(__('Risk Score'))
                        ->default('—'),
                    Infolists\Components\TextEntry::make('meta.fraud_seller_message')
                        ->label(__('Note'))
                        ->default('—')
                        ->columnSpanFull(),
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
                                ->label(__('Product'))
                                ->columnSpan(3),
                            Infolists\Components\TextEntry::make('quantity')
                                ->label(__('Qty'))
                                ->columnSpan(1),
                            Infolists\Components\TextEntry::make('unit_price')
                                ->label(__('Unit Price'))
                                ->formatStateUsing(fn($state) => '$' . number_format(($state->value ?? (int) $state) / 100, 2))
                                ->columnSpan(1),
                            Infolists\Components\TextEntry::make('sub_total')
                                ->label(__('Subtotal'))
                                ->formatStateUsing(fn($state) => '$' . number_format(($state->value ?? (int) $state) / 100, 2))
                                ->columnSpan(1),
                        ])
                        ->columns(6)
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

                            $paymentRows = [
                                "Payment Method: {$paymentMethod}",
                                "Payment Status: {$paymentStatus}",
                            ];

                            if ($couponCode = $record->meta['coupon_code'] ?? null) {
                                $paymentRows[] = "Coupon: {$couponCode}";
                            }

                            return '<div style="line-height: 2; margin-right: 1.5rem;">'
                                . implode('<br>', $rows)
                                . '<hr style="margin: 4px 0; border-color: rgb(228 228 231);">'
                                . implode('<br>', $paymentRows)
                                . '</div>';
                        })
                        ->extraAttributes(['class' => '-mt-8']),
                ]),

            Infolists\Components\Section::make(__('Order Notes'))
                ->schema([
                    Infolists\Components\TextEntry::make('notes')
                        ->label(__('Customer Note'))
                        ->default('—')
                        ->columnSpanFull(),
                    Infolists\Components\RepeatableEntry::make('orderEvents')
                        ->label('')
                        ->state(fn($record) => $record->orderEvents()->latest('id')->get())
                        ->schema([
                            Infolists\Components\TextEntry::make('title')
                                ->label('')
                                ->html()
                                ->state(fn($record) => '<strong>' . e($record->title) . '</strong>'
                                    . ($record->detail ? '<br><span style="color:#6b7280;">' . e($record->detail) . '</span>' : '')),
                            Infolists\Components\TextEntry::make('occurred_at')
                                ->label('')
                                ->state(fn($record) => optional($record->occurred_at ?? $record->created_at)->format('M j, Y g:i A'))
                                ->color('gray')
                                ->alignEnd(),
                        ])
                        ->columns(2)
                        ->columnSpanFull(),
                ]),
        ]);
    }
}
