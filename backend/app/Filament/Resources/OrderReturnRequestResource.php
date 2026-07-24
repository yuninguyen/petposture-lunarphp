<?php

namespace App\Filament\Resources;

use App\Filament\Resources\OrderReturnRequestResource\Pages;
use App\Models\OrderReturnRequest;
use App\Services\ReturnRequestService;
use Filament\Forms;
use Filament\Forms\Form;
use Filament\Forms\Get;
use Filament\Resources\Resource;
use Filament\Tables;
use Filament\Tables\Table;

class OrderReturnRequestResource extends Resource
{
    protected static ?string $model = OrderReturnRequest::class;

    protected static ?string $navigationIcon = 'heroicon-o-arrow-uturn-left';

    protected static ?int $navigationSort = 4;

    public static function getNavigationGroup(): ?string
    {
        return __('lunarpanel::global.sections.sales');
    }

    public static function getLabel(): string
    {
        return __('Return Request');
    }

    public static function getPluralLabel(): string
    {
        return __('Return Requests');
    }

    public static function form(Form $form): Form
    {
        return $form->schema([]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->columns([
                Tables\Columns\TextColumn::make('order.reference')
                    ->label(__('Order'))
                    ->formatStateUsing(fn (?string $state): string => $state ? "#{$state}" : '—')
                    ->searchable()
                    ->sortable(),
                Tables\Columns\TextColumn::make('reason')
                    ->label(__('Reason'))
                    ->limit(40),
                Tables\Columns\TextColumn::make('status')
                    ->label(__('Status'))
                    ->badge()
                    ->color(fn (string $state): string => match ($state) {
                        'requested' => 'warning',
                        'approved' => 'info',
                        'rejected' => 'danger',
                        'completed' => 'success',
                        default => 'gray',
                    })
                    ->formatStateUsing(fn (string $state): string => str($state)->headline()->toString()),
                Tables\Columns\TextColumn::make('items_count')
                    ->label(__('Items'))
                    ->counts('items'),
                Tables\Columns\TextColumn::make('requested_at')
                    ->label(__('Requested'))
                    ->dateTime()
                    ->sortable(),
            ])
            ->filters([
                Tables\Filters\SelectFilter::make('status')
                    ->label(__('Status'))
                    ->options([
                        'requested' => __('Requested'),
                        'approved' => __('Approved'),
                        'rejected' => __('Rejected'),
                        'completed' => __('Completed'),
                    ]),
            ])
            ->actions([
                Tables\Actions\Action::make('approve')
                    ->label(__('Approve'))
                    ->icon('heroicon-o-check')
                    ->color('success')
                    ->visible(fn (OrderReturnRequest $record) => $record->status === OrderReturnRequest::STATUS_REQUESTED)
                    ->form([
                        Forms\Components\Textarea::make('rma_address')
                            ->label(__('RMA Return Address'))
                            ->required(),
                        Forms\Components\Toggle::make('fee_waived')
                            ->label(__('Waive 25% restocking fee (defective/wrong item)'))
                            ->live(),
                        Forms\Components\Placeholder::make('refund_estimate')
                            ->label(__('Computed refund estimate'))
                            ->content(function (Get $get, OrderReturnRequest $record): string {
                                $estimate = app(ReturnRequestService::class)->calculateRefundEstimate($record, (bool) $get('fee_waived'));

                                return sprintf(
                                    'Item value: $%.2f — Restocking fee: $%.2f — Estimated refund: $%.2f',
                                    $estimate['item_subtotal_minor'] / 100,
                                    $estimate['restocking_fee_minor'] / 100,
                                    $estimate['refund_amount_minor'] / 100,
                                );
                            }),
                        Forms\Components\TextInput::make('refund_amount_override')
                            ->label(__('Override refund amount (optional, leave blank to use the computed estimate above)'))
                            ->numeric()
                            ->prefix('$'),
                        Forms\Components\Textarea::make('admin_note')
                            ->label(__('Note to customer (optional)')),
                    ])
                    ->requiresConfirmation()
                    ->action(function (OrderReturnRequest $record, array $data) {
                        $refundAmountOverrideMinor = filled($data['refund_amount_override'] ?? null)
                            ? (int) round(((float) $data['refund_amount_override']) * 100)
                            : null;

                        app(ReturnRequestService::class)->approve(
                            $record,
                            $data['rma_address'],
                            (bool) ($data['fee_waived'] ?? false),
                            $refundAmountOverrideMinor,
                            $data['admin_note'] ?? null,
                        );
                    }),
                Tables\Actions\Action::make('reject')
                    ->label(__('Reject'))
                    ->icon('heroicon-o-x-mark')
                    ->color('danger')
                    ->visible(fn (OrderReturnRequest $record) => $record->status === OrderReturnRequest::STATUS_REQUESTED)
                    ->form([
                        Forms\Components\Textarea::make('admin_note')
                            ->label(__('Reason for rejection'))
                            ->required(),
                    ])
                    ->requiresConfirmation()
                    ->action(fn (OrderReturnRequest $record, array $data) => app(ReturnRequestService::class)->reject($record, $data['admin_note'])),
                Tables\Actions\Action::make('complete')
                    ->label(__('Mark Item Received'))
                    ->icon('heroicon-o-inbox-arrow-down')
                    ->color('gray')
                    ->visible(fn (OrderReturnRequest $record) => $record->status === OrderReturnRequest::STATUS_APPROVED)
                    ->requiresConfirmation()
                    ->modalDescription(__('This confirms the returned item(s) have been received and notifies the customer. Use the Refund action on the order separately once inspected.'))
                    ->action(fn (OrderReturnRequest $record) => app(ReturnRequestService::class)->complete($record)),
            ]);
    }

    public static function getPages(): array
    {
        return [
            'index' => Pages\ListOrderReturnRequests::route('/'),
        ];
    }

    public static function canCreate(): bool
    {
        return false;
    }
}
