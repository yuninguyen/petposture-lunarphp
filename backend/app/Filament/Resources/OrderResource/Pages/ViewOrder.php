<?php

namespace App\Filament\Resources\OrderResource\Pages;

use App\Filament\Resources\OrderResource;
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
                $isShipped = $action['action'] === 'markShipped';

                $builder = Actions\Action::make($action['action'])
                    ->label($action['label'])
                    ->color($isCancel ? 'danger' : 'primary')
                    ->requiresConfirmation();

                if ($isShipped) {
                    $builder = $builder
                        ->modalDescription(__('Enter the tracking number so the customer can track their shipment and AfterShip can auto-update delivery status.'))
                        ->form([
                            Forms\Components\TextInput::make('tracking_number')
                                ->label(__('Tracking Number'))
                                ->maxLength(255),
                            Forms\Components\Select::make('shipment_carrier')
                                ->label(__('Carrier'))
                                ->native(false)
                                ->options([
                                    'ups' => 'UPS',
                                    'usps' => 'USPS',
                                    'fedex' => 'FedEx',
                                    'dhl' => 'DHL',
                                    'manual' => 'Other / Manual',
                                ])
                                ->default('manual'),
                        ]);
                }

                return $builder->action(function (array $data = []) use ($operations, $action) {
                    $operations->performAction($this->record, $action['action'], $data);

                    $this->redirect(static::getUrl(['record' => $this->record]));
                });
            })
            ->all();

        $secondaryActions = [];

        $meta = (array) ($this->record->meta ?? []);

        $isReturnable = in_array((string) $this->record->status, ['delivered', 'shipped'], true)
            && ($meta['fulfillment_status'] ?? null) !== 'returned';

        if ($isReturnable) {
            $secondaryActions[] = Actions\Action::make('markReturned')
                ->label(__('Mark Returned'))
                ->color('gray')
                ->requiresConfirmation()
                ->modalDescription(__('This notifies the customer that their return has been received. It does not issue a refund — use the Refund action separately once you\'ve inspected the returned item(s).'))
                ->action(function () {
                    app(OrderOperationsService::class)->returnOrder($this->record);

                    $this->redirect(static::getUrl(['record' => $this->record]));
                });
        }

        $isRefundable = filled($meta['payment_intent_id'] ?? null)
            && ($meta['payment_status'] ?? null) === 'paid'
            && ($meta['refund_status'] ?? null) !== 'refunded';

        if ($isRefundable) {
            $secondaryActions[] = Actions\Action::make('refund')
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

        if ($secondaryActions !== []) {
            $actions[] = Actions\ActionGroup::make($secondaryActions)
                ->label(__('More Actions'))
                ->icon('heroicon-o-ellipsis-vertical')
                ->color('gray')
                ->button()
                ->outlined()
                ->dropdownPlacement('bottom-end');
        }

        return $actions;
    }

    private static function formatAddressBlock($address): string
    {
        if (!$address) {
            return '—';
        }

        $lines = [
            trim(($address->first_name ?? '') . ' ' . ($address->last_name ?? '')),
            collect([$address->line_one, $address->line_two])->filter()->implode(', '),
            collect([
                $address->city,
                trim(($address->state ?? '') . ' ' . ($address->postcode ?? '')),
            ])->filter()->implode(', '),
            $address->country?->name,
            $address->contact_phone,
        ];

        return collect($lines)->filter()->implode('<br>') ?: '—';
    }

    private static function formatCustomerIpBlock(array $meta): string
    {
        $lines = [
            'IP' => $meta['customer_ip'] ?? null,
            'Location' => $meta['customer_ip_location'] ?? null,
            'ISP' => $meta['customer_ip_isp'] ?? null,
            'User Agent' => $meta['customer_user_agent'] ?? null,
            'Service' => $meta['customer_ip_service_type'] ?? null,
        ];

        return collect($lines)
            ->filter()
            ->map(fn($value, $label) => '<strong>' . e($label) . ':</strong> ' . e($value))
            ->implode('<br>') ?: '—';
    }

    private static function formatTrackingBlock(array $meta): string
    {
        $trackingNumber = (string) ($meta['tracking_number'] ?? '');

        if ($trackingNumber === '') {
            return '—';
        }

        $carrierLabels = [
            'ups' => 'UPS',
            'usps' => 'USPS',
            'fedex' => 'FedEx',
            'dhl' => 'DHL',
            'manual' => 'Other / Manual',
        ];
        $carrierLabel = $carrierLabels[$meta['shipment_carrier'] ?? 'manual'] ?? str($meta['shipment_carrier'] ?? 'manual')->headline()->toString();

        $trackingDisplay = e($trackingNumber);

        $shipments = array_values(array_filter((array) ($meta['shipments'] ?? []), 'is_array'));
        $latestShipment = $shipments[array_key_last($shipments)] ?? [];
        $url = $meta['shipment_tracking_url'] ?? $latestShipment['tracking_url'] ?? null;

        if ($url) {
            $trackingDisplay = '<a href="' . e($url) . '" target="_blank" rel="noopener" style="text-decoration: underline;">' . $trackingDisplay . '</a>';
        }

        return "<strong>{$carrierLabel}:</strong> {$trackingDisplay}";
    }

    public function infolist(Infolist $infolist): Infolist
    {
        return $infolist->schema([

            Infolists\Components\Grid::make(12)
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
                            Infolists\Components\TextEntry::make('tracking_block')
                                ->label(__('Tracking'))
                                ->html()
                                ->visible(fn($record) => filled($record->meta['tracking_number'] ?? null))
                                ->state(fn($record) => static::formatTrackingBlock((array) ($record->meta ?? []))),
                            Infolists\Components\TextEntry::make('customer_ip_block')
                                ->label(__('Customer IP'))
                                ->html()
                                ->state(fn($record) => static::formatCustomerIpBlock((array) ($record->meta ?? [])))
                                ->columnSpanFull(),
                        ])->columns(2)->columnSpan(6)->extraAttributes(['class' => 'h-full']),

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
                        ])->columnSpan(3)->extraAttributes(['class' => 'h-full']),

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
                        ])->columnSpan(3)->extraAttributes(['class' => 'h-full']),
                ])->extraAttributes(['class' => 'items-stretch']),

            Infolists\Components\Grid::make(2)
                ->schema([
                    Infolists\Components\Section::make(__('Shipping Address'))
                        ->schema([
                            Infolists\Components\TextEntry::make('shipping_block')
                                ->label('')
                                ->html()
                                ->state(fn($record) => static::formatAddressBlock($record->shippingAddress)),
                        ])->columnSpan(1),

                    Infolists\Components\Section::make(__('Billing Address'))
                        ->schema([
                            Infolists\Components\TextEntry::make('billing_block')
                                ->label('')
                                ->html()
                                ->state(fn($record) => static::formatAddressBlock($record->billingAddress)),
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

                            $shippingMethodName = app(\App\Services\ShippingService::class)
                                ->nameFor((string) ($record->meta['shipping_method'] ?? 'standard'));
                            $rows[] = "Shipping - {$shippingMethodName}: " . $money($record->shipping_total);
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
