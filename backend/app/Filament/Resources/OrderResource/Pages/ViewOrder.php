<?php

namespace App\Filament\Resources\OrderResource\Pages;

use App\Filament\Resources\OrderResource;
use App\Models\OrderShipmentItem;
use App\Services\OrderOperationsService;
use App\Services\ShippingService;
use Filament\Actions;
use Filament\Forms;
use Filament\Infolists;
use Filament\Infolists\Infolist;
use Filament\Resources\Pages\ViewRecord;
use Lunar\Models\Order;
use Lunar\Models\OrderLine;

class ViewOrder extends ViewRecord
{
    protected static string $resource = OrderResource::class;

    private function order(): Order
    {
        /** @var Order $record */
        $record = $this->record;

        return $record;
    }

    protected function getHeaderActions(): array
    {
        $operations = app(OrderOperationsService::class);

        $actions = collect($operations->availableActions($this->record))
            ->reject(fn (array $action) => $action['action'] === 'markShipped')
            ->map(function (array $action) {
                $isCancel = $action['action'] === 'cancelOrder';

                return Actions\Action::make($action['action'])
                    ->label($action['label'])
                    ->color($isCancel ? 'danger' : 'primary')
                    ->requiresConfirmation()
                    ->action(function () use ($action) {
                        app(OrderOperationsService::class)->performAction($this->record, $action['action']);

                        $this->redirect(static::getUrl(['record' => $this->record]));
                    });
            })
            ->all();

        $remainingQuantities = $operations->remainingShippableQuantities($this->record);
        $shippableLines = $this->order()->lines->where('type', '!=', 'shipping')
            ->filter(fn ($line) => ($remainingQuantities[$line->id] ?? 0) > 0);
        $isFirstShipment = (string) $this->order()->status === 'processing';
        $canShip = $shippableLines->isNotEmpty()
            && in_array((string) $this->order()->status, ['processing', 'shipped'], true);

        if ($canShip) {
            $lineOptions = $shippableLines->mapWithKeys(fn ($line) => [
                $line->id => $line->description.' (remaining: '.$remainingQuantities[$line->id].')',
            ])->all();
            $defaultItems = $shippableLines->map(fn ($line) => [
                'order_line_id' => $line->id,
                'quantity' => $remainingQuantities[$line->id],
            ])->values()->all();

            $actions[] = Actions\Action::make('shipItems')
                ->label($isFirstShipment ? __('Mark Shipped') : __('Add Shipment'))
                ->color($isFirstShipment ? 'primary' : 'gray')
                ->requiresConfirmation()
                ->modalDescription(__('Select which items are in this package and enter its tracking number so the customer can track it and AfterShip can auto-update delivery status.'))
                ->form([
                    Forms\Components\TextInput::make('tracking_number')
                        ->label(__('Tracking Number'))
                        ->required()
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
                    Forms\Components\Repeater::make('items')
                        ->label(__('Items in this package'))
                        ->schema([
                            Forms\Components\Select::make('order_line_id')
                                ->label(__('Item'))
                                ->options($lineOptions)
                                ->required(),
                            Forms\Components\TextInput::make('quantity')
                                ->label(__('Qty'))
                                ->numeric()
                                ->minValue(1)
                                ->required(),
                        ])
                        ->columns(2)
                        ->default($defaultItems)
                        ->addActionLabel(__('Add another item')),
                ])
                ->action(function (array $data) use ($operations) {
                    if ((string) $this->order()->status === 'processing') {
                        $operations->performAction($this->record, 'markShipped', []);
                    }

                    $operations->recordShipment($this->record->fresh(), $data);

                    $this->redirect(static::getUrl(['record' => $this->record]));
                });
        }

        $secondaryActions = [];

        $meta = (array) ($this->record->meta ?? []);

        $isReturnable = in_array((string) $this->order()->status, ['delivered', 'shipped'], true)
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
                    Forms\Components\Select::make('reason')
                        ->label(__('Reason'))
                        ->options(OrderOperationsService::REFUND_REASON_LABELS)
                        ->native(false)
                        ->required(),
                ])
                ->requiresConfirmation()
                ->action(function (array $data) {
                    $amountMinor = filled($data['amount'] ?? null)
                        ? (int) round(((float) $data['amount']) * 100)
                        : null;

                    app(OrderOperationsService::class)->refundOrder($this->record, $amountMinor, $data['reason']);

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
        if (! $address) {
            return '—';
        }

        $lines = [
            trim(($address->first_name ?? '').' '.($address->last_name ?? '')),
            collect([$address->line_one, $address->line_two])->filter()->implode(', '),
            collect([
                $address->city,
                trim(($address->state ?? '').' '.($address->postcode ?? '')),
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
            ->map(fn ($value, $label) => '<strong>'.e($label).':</strong> '.e($value))
            ->implode('<br>') ?: '—';
    }

    private static array $carrierLabels = [
        'ups' => 'UPS',
        'usps' => 'USPS',
        'fedex' => 'FedEx',
        'dhl' => 'DHL',
        'manual' => 'Other / Manual',
    ];

    private static function formatLineTracking(OrderLine $line): ?string
    {
        $shipmentItems = OrderShipmentItem::query()
            ->where('order_line_id', $line->id)
            ->with('shipment')
            ->get()
            ->filter(fn ($item) => $item->shipment !== null);

        if ($shipmentItems->isEmpty()) {
            return null;
        }

        $rows = $shipmentItems->map(function ($item) {
            $shipment = $item->shipment;
            $carrierLabel = self::$carrierLabels[$shipment->carrier] ?? str($shipment->carrier)->headline()->toString();
            $display = e($shipment->tracking_number).' &times; '.$item->quantity;

            if ($shipment->tracking_url) {
                $display = '<a href="'.e($shipment->tracking_url).'" target="_blank" rel="noopener" style="text-decoration: underline;">'.$display.'</a>';
            }

            return "<strong>{$carrierLabel}:</strong> {$display}";
        });

        return '<span style="font-size: 12px; color: #9a9a9a;">'.$rows->implode(' &nbsp;|&nbsp; ').'</span>';
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
                                ->formatStateUsing(fn (string $state): string => "#{$state}"),
                            Infolists\Components\TextEntry::make('status')
                                ->label(__('Order Status'))
                                ->badge()
                                ->formatStateUsing(fn (string $state): string => str($state)->headline()->toString())
                                ->color(fn (string $state): string => match (true) {
                                    \in_array($state, ['awaiting-payment', 'payment-offline']) => 'warning',
                                    $state === 'cancelled' => 'danger',
                                    \in_array($state, ['payment-received', 'processing', 'shipped']) => 'info',
                                    $state === 'delivered' => 'success',
                                    default => 'gray',
                                }),
                            Infolists\Components\TextEntry::make('meta.payment_status')
                                ->label(__('Payment Status'))
                                ->badge()
                                ->formatStateUsing(fn (?string $state): string => $state ? str($state)->headline()->toString() : '—')
                                ->color(fn (?string $state): string => match ($state) {
                                    'paid' => 'success',
                                    'partially-refunded' => 'warning',
                                    'refunded' => 'gray',
                                    'failed' => 'danger',
                                    'pending' => 'warning',
                                    default => 'gray',
                                }),
                            Infolists\Components\TextEntry::make('meta.payment_method')
                                ->label(__('Payment Method'))
                                ->formatStateUsing(fn (?string $state): string => match ($state) {
                                    'cod' => 'COD',
                                    'card' => 'Credit Card',
                                    'paypal' => 'PayPal',
                                    default => $state ? str($state)->headline()->toString() : '—',
                                }),
                            Infolists\Components\TextEntry::make('meta.refund_reason')
                                ->label(__('Refund Reason'))
                                ->visible(fn ($record) => filled($record->meta['refund_reason'] ?? null))
                                ->formatStateUsing(fn (?string $state): string => $state
                                    ? (OrderOperationsService::REFUND_REASON_LABELS[$state] ?? $state)
                                    : '—'),
                            Infolists\Components\TextEntry::make('customer_reference')
                                ->label(__('Customer Email')),
                            Infolists\Components\TextEntry::make('created_at')
                                ->label(__('Date'))
                                ->dateTime(),
                            Infolists\Components\TextEntry::make('customer_ip_block')
                                ->label(__('Customer IP'))
                                ->html()
                                ->state(fn ($record) => self::formatCustomerIpBlock((array) ($record->meta ?? [])))
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
                        ->visible(fn ($record) => filled($record->meta['fraud_risk_level'] ?? null))
                        ->schema([
                            Infolists\Components\TextEntry::make('meta.fraud_risk_level')
                                ->label(__('Risk Level'))
                                ->badge()
                                ->formatStateUsing(fn (?string $state): string => $state ? str($state)->headline()->toString() : '—')
                                ->color(fn (?string $state): string => match ($state) {
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
                                ->state(fn ($record) => self::formatAddressBlock($record->shippingAddress)),
                        ])->columnSpan(1),

                    Infolists\Components\Section::make(__('Billing Address'))
                        ->schema([
                            Infolists\Components\TextEntry::make('billing_block')
                                ->label('')
                                ->html()
                                ->state(fn ($record) => self::formatAddressBlock($record->billingAddress)),
                        ])->columnSpan(1),
                ]),

            Infolists\Components\Section::make(__('Items'))
                ->schema([
                    Infolists\Components\RepeatableEntry::make('lines')
                        ->label('')
                        ->state(fn ($record) => $record->lines->where('type', '!=', 'shipping')->values())
                        ->schema([
                            Infolists\Components\TextEntry::make('description')
                                ->label(__('Product'))
                                ->columnSpan(3),
                            Infolists\Components\TextEntry::make('quantity')
                                ->label(__('Qty'))
                                ->columnSpan(1),
                            Infolists\Components\TextEntry::make('unit_price')
                                ->label(__('Unit Price'))
                                ->formatStateUsing(fn ($state) => '$'.number_format(($state->value ?? (int) $state) / 100, 2))
                                ->columnSpan(1),
                            Infolists\Components\TextEntry::make('sub_total')
                                ->label(__('Subtotal'))
                                ->formatStateUsing(fn ($state) => '$'.number_format(($state->value ?? (int) $state) / 100, 2))
                                ->columnSpan(1),
                            Infolists\Components\TextEntry::make('shipment_tracking')
                                ->label('')
                                ->html()
                                ->visible(fn ($record) => self::formatLineTracking($record) !== null)
                                ->state(fn ($record) => self::formatLineTracking($record))
                                ->columnSpanFull()
                                ->extraAttributes(['class' => '-mt-4']),
                        ])
                        ->columns(6)
                        ->columnSpanFull(),

                    Infolists\Components\TextEntry::make('totals_block')
                        ->label('')
                        ->alignEnd()
                        ->html()
                        ->columnSpanFull()
                        ->state(function ($record) {
                            $money = fn ($state) => '$'.number_format(($state->value ?? (int) $state) / 100, 2);
                            $discount = (int) ($record->discount_total->value ?? $record->discount_total ?? 0);

                            $rows = [
                                'Items Subtotal: '.$money($record->sub_total),
                            ];

                            $couponCode = $record->meta['coupon_code'] ?? null;

                            if ($discount > 0) {
                                $rows[] = 'Discount: -'.$money($record->discount_total).($couponCode ? " ({$couponCode})" : '');
                            } elseif ($couponCode) {
                                $rows[] = "Coupon: {$couponCode}";
                            }

                            $shippingMethodName = app(ShippingService::class)
                                ->nameFor((string) ($record->meta['shipping_method'] ?? 'standard'));
                            $rows[] = "Shipping - {$shippingMethodName}: ".$money($record->shipping_total);
                            $rows[] = 'Tax: '.$money($record->tax_total);
                            $rows[] = '<strong>Order Total: '.$money($record->total).'</strong>';

                            return '<div style="line-height: 2; margin-right: 1.5rem;">'
                                .implode('<br>', $rows)
                                .'</div>';
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
                        ->state(fn ($record) => $record->orderEvents()->latest('id')->get())
                        ->schema([
                            Infolists\Components\TextEntry::make('title')
                                ->label('')
                                ->html()
                                ->state(fn ($record) => '<strong>'.e($record->title).'</strong>'
                                    .($record->detail ? '<br><span style="color:#6b7280;">'.e($record->detail).'</span>' : '')),
                            Infolists\Components\TextEntry::make('occurred_at')
                                ->label('')
                                ->state(fn ($record) => optional($record->occurred_at ?? $record->created_at)->format('M j, Y g:i A'))
                                ->color('gray')
                                ->alignEnd(),
                        ])
                        ->columns(2)
                        ->columnSpanFull(),
                ]),
        ]);
    }
}
