<?php

namespace App\Filament\Widgets;

use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Table;
use Filament\Widgets\TableWidget;
use Lunar\Models\Order;

class LatestOrdersTable extends TableWidget
{
    protected static string $view = 'filament.widgets.latest-orders-table';

    protected static ?int $sort = 5;

    protected int|string|array $columnSpan = [
        'default' => 1,
        'md' => 2,
        'xl' => 2,
    ];

    protected function getTablePollingInterval(): ?string
    {
        return '60s';
    }

    public static function getHeading(): ?string
    {
        return __('admin.dashboard.recent_orders');
    }

    public function table(Table $table): Table
    {
        return $table
            ->heading($this->getHeading())
            ->query(fn () => Order::with('currency')
                ->orderBy('placed_at', 'desc')
                ->orderBy('created_at', 'desc')
                ->limit(6))
            ->paginated(false)
            ->searchable(false)
            ->columns([
                TextColumn::make('placed_at')
                    ->label(__('admin.dashboard.recent_orders_columns.date'))
                    ->date('M j'),
                TextColumn::make('reference')
                    ->label(__('admin.dashboard.recent_orders_columns.order')),
                TextColumn::make('billingAddress.fullName')
                    ->label(__('admin.dashboard.recent_orders_columns.customer'))
                    ->limit(24),
                TextColumn::make('status')
                    ->label(__('admin.dashboard.recent_orders_columns.status'))
                    ->badge()
                    ->formatStateUsing(fn (string $state): string => __('admin.orders.statuses.'.$state))
                    ->color(fn (string $state): string => match ($state) {
                        'awaiting-payment' => 'warning',
                        'payment-received' => 'info',
                        'processing' => 'gray',
                        'shipped' => 'primary',
                        'delivered' => 'success',
                        'cancelled' => 'danger',
                        default => 'gray',
                    }),
                TextColumn::make('total')
                    ->label(__('admin.dashboard.recent_orders_columns.total'))
                    ->formatStateUsing(fn ($state) => $state->formatted),
            ]);
    }
}
