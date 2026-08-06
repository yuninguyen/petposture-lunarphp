<?php

namespace App\Filament\Widgets;

use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Table;
use Filament\Widgets\TableWidget;
use Lunar\Facades\DB;
use Lunar\Models\OrderLine;

class TopProductsWidget extends TableWidget
{
    protected static ?int $sort = 3;

    protected int|string|array $columnSpan = [
        'default' => 1,
        'md' => 2,
        'xl' => 2,
    ];

    public function getTablePollingInterval(): ?string
    {
        return '60s';
    }

    public static function getHeading(): ?string
    {
        return __('admin.dashboard.top_products');
    }

    public function table(Table $table): Table
    {
        return $table
            ->heading($this->getHeading())
            ->query(function () {
                return OrderLine::query()
                    ->with('currency')
                    ->whereHas('order', function ($relation) {
                        $relation->whereBetween('placed_at', [
                            now()->subYear()->startOfDay(),
                            now()->endOfDay(),
                        ]);
                    })
                    ->select(
                        DB::RAW('MAX(id) as id'),
                        DB::RAW('SUM(quantity) as quantity'),
                        DB::RAW('SUM(sub_total) as sub_total'),
                        DB::RAW('MAX(description) as description'),
                        'identifier',
                    )
                    ->groupBy('identifier', 'purchasable_id')
                    ->whereType('physical')
                    ->limit(5);
            })
            ->defaultSort('sub_total', 'desc')
            ->paginated(false)
            ->columns([
                TextColumn::make('description')
                    ->label(__('admin.dashboard.top_products_columns.product')),
                TextColumn::make('identifier')
                    ->label(__('admin.dashboard.top_products_columns.sku')),
                TextColumn::make('quantity')
                    ->label(__('admin.dashboard.top_products_columns.sold'))
                    ->numeric(),
                TextColumn::make('sub_total')
                    ->label(__('admin.dashboard.top_products_columns.revenue'))
                    ->formatStateUsing(fn ($state) => $state->formatted),
            ]);
    }
}
