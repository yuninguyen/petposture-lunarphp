<?php

namespace App\Filament\Resources;

use App\Filament\Resources\CustomerResource\Pages\ListCustomers;
use App\Filament\Resources\CustomerResource\Pages\ViewCustomer;
use App\Filament\Resources\CustomerResource\RelationManagers\OrdersRelationManager;
use Filament\Tables;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;
use Lunar\Admin\Filament\Resources\CustomerResource as BaseCustomerResource;
use Lunar\Admin\Filament\Resources\CustomerResource\RelationManagers\AddressRelationManager;
use Lunar\Admin\Filament\Resources\CustomerResource\RelationManagers\UserRelationManager;
use Lunar\Models\Customer;

class CustomerResource extends BaseCustomerResource
{
    public static function getNavigationSort(): ?int
    {
        return 2;
    }

    /**
     * Replaces Lunar's default table (first_name/last_name/company_name/
     * tax_identifier/account_ref/customerGroups only — no email, orders,
     * spend, join date, or status) with the columns actually wanted:
     * Name, Email, Total Orders, Total Spent, Joined, Status. "Status" has
     * no native concept on Lunar's Customer model — derived from the first
     * linked user account's is_active (guests with no linked account read
     * as Active, since they are never login-gated in the first place).
     */
    protected static function getDefaultTable(Table $table): Table
    {
        return $table
            ->modifyQueryUsing(fn (Builder $query) => $query
                ->with('users')
                ->withCount('orders')
                ->withSum('orders', 'total'))
            ->columns([
                Tables\Columns\TextColumn::make('name')
                    ->label(__('Name'))
                    ->getStateUsing(fn (Customer $record) => trim("{$record->first_name} {$record->last_name}"))
                    ->searchable(['first_name', 'last_name'])
                    ->sortable(['first_name']),
                Tables\Columns\TextColumn::make('email')
                    ->label(__('Email'))
                    ->getStateUsing(fn (Customer $record) => $record->users->first()?->email)
                    ->placeholder(__('Guest'))
                    ->searchable(query: fn (Builder $query, string $search) => $query->orWhereHas(
                        'users',
                        fn (Builder $userQuery) => $userQuery->where('email', 'like', "%{$search}%")
                    )),
                Tables\Columns\TextColumn::make('orders_count')
                    ->label(__('Total Orders'))
                    ->numeric()
                    ->sortable(),
                Tables\Columns\TextColumn::make('orders_sum_total')
                    ->label(__('Total Spent'))
                    ->getStateUsing(fn (Customer $record) => '$'.number_format(($record->orders_sum_total ?? 0) / 100, 2))
                    ->sortable(),
                Tables\Columns\TextColumn::make('created_at')
                    ->label(__('Joined'))
                    ->date('M j, Y')
                    ->sortable(),
                Tables\Columns\TextColumn::make('status')
                    ->label(__('Status'))
                    ->getStateUsing(fn (Customer $record) => ($record->users->first()?->is_active ?? true) ? __('Active') : __('Inactive'))
                    ->badge()
                    ->color(fn (string $state) => $state === __('Active') ? 'success' : 'danger'),
            ])
            ->filters([
                Tables\Filters\SelectFilter::make('status')
                    ->label(__('Status'))
                    ->options([
                        'active' => __('Active'),
                        'inactive' => __('Inactive'),
                    ])
                    ->query(fn (Builder $query, array $data) => match ($data['value'] ?? null) {
                        'active' => $query->whereDoesntHave('users', fn (Builder $q) => $q->where('is_active', false)),
                        'inactive' => $query->whereHas('users', fn (Builder $q) => $q->where('is_active', false)),
                        default => $query,
                    }),
            ])
            ->actions([
                Tables\Actions\ViewAction::make(),
            ])
            ->bulkActions([
                Tables\Actions\BulkActionGroup::make([
                    Tables\Actions\DeleteBulkAction::make(),
                ]),
            ])
            ->defaultSort('created_at', 'desc');
    }

    public static function getDefaultRelations(): array
    {
        return [
            // Overrides Lunar's base OrdersRelationManager, which links to
            // Lunar's own ManageOrder page — this app's OrderResource uses
            // a custom ViewOrder page instead, under a different route name.
            OrdersRelationManager::class,
            AddressRelationManager::class,
            UserRelationManager::class,
        ];
    }

    public static function getDefaultPages(): array
    {
        return array_merge(parent::getDefaultPages(), [
            // Lunar's own ListCustomers/ViewCustomer pages hardcode $resource
            // to Lunar's base CustomerResource, which bypasses our
            // getDefaultTable()/getDefaultRelations() overrides above
            // entirely. These overrides point them back at this class.
            'index' => ListCustomers::route('/'),
            'view' => ViewCustomer::route('/{record}'),
        ]);
    }
}
