<?php

namespace App\Filament\Resources;

use App\Filament\Resources\CustomerResource\Pages;
use Lunar\Models\Customer;
use Filament\Forms;
use Filament\Forms\Form;
use Filament\Resources\Resource;
use Filament\Tables;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;

class CustomerResource extends Resource
{
    protected static ?string $model = Customer::class;

    protected static ?string $navigationIcon = 'heroicon-o-user-group';

    public static function getNavigationGroup(): ?string
    {
        return __('Sales');
    }

    protected static ?string $recordTitleAttribute = 'first_name';

    public static function getLabel(): string
    {
        return __('admin.customers.label');
    }

    public static function getPluralLabel(): string
    {
        return __('admin.customers.plural_label');
    }

    public static function form(Form $form): Form
    {
        return $form
            ->schema([
                Forms\Components\Group::make()
                    ->schema([
                        Forms\Components\Section::make(__('admin.customers.sections.personal'))
                            ->schema([
                                Forms\Components\TextInput::make('first_name')
                                    ->label(__('admin.customers.fields.first_name'))
                                    ->required()
                                    ->maxLength(255),
                                Forms\Components\TextInput::make('last_name')
                                    ->label(__('admin.customers.fields.last_name'))
                                    ->required()
                                    ->maxLength(255),
                                Forms\Components\TextInput::make('title')
                                    ->label(__('admin.customers.fields.title'))
                                    ->maxLength(255),
                                Forms\Components\TextInput::make('company_name')
                                    ->label(__('admin.customers.fields.company_name'))
                                    ->maxLength(255),
                            ])->columns(2),

                        Forms\Components\Section::make(__('admin.customers.sections.identifiers'))
                            ->schema([
                                Forms\Components\TextInput::make('tax_identifier')
                                    ->label(__('admin.customers.fields.tax_id'))
                                    ->maxLength(255),
                                Forms\Components\TextInput::make('account_ref')
                                    ->label(__('admin.customers.fields.account_ref'))
                                    ->maxLength(255),
                            ])->columns(2),
                    ])->columnSpan(['lg' => 2]),

                Forms\Components\Group::make()
                    ->schema([
                        Forms\Components\Section::make(__('admin.customers.sections.status'))
                            ->schema([
                                Forms\Components\CheckboxList::make('customerGroups')
                                    ->label(__('admin.customers.fields.customer_groups'))
                                    ->relationship('customerGroups', 'name')
                                    ->searchable(),
                            ]),
                    ])->columnSpan(['lg' => 1]),
            ])->columns(3);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->columns([
                Tables\Columns\TextColumn::make('name')
                    ->label('Name')
                    ->getStateUsing(fn($record) => "{$record->first_name} {$record->last_name}")
                    ->searchable(['first_name', 'last_name'])
                    ->sortable(),
                Tables\Columns\TextColumn::make('company_name')
                    ->searchable(),
                Tables\Columns\TextColumn::make('customerGroups.name')
                    ->badge()
                    ->color('info')
                    ->label('Group'),
                Tables\Columns\TextColumn::make('orders_count')
                    ->counts('orders')
                    ->label('Orders')
                    ->sortable(),
                Tables\Columns\TextColumn::make('created_at')
                    ->dateTime()
                    ->sortable()
                    ->toggleable(isToggledHiddenByDefault: true),
            ])
            ->filters([
                Tables\Filters\SelectFilter::make('customerGroups')
                    ->relationship('customerGroups', 'name'),
            ])
            ->actions([
                Tables\Actions\ViewAction::make(),
                Tables\Actions\EditAction::make(),
            ])
            ->bulkActions([
                Tables\Actions\BulkActionGroup::make([
                    Tables\Actions\DeleteBulkAction::make(),
                ]),
            ]);
    }

    public static function getRelations(): array
    {
        return [
            CustomerResource\RelationManagers\AddressesRelationManager::class,
            CustomerResource\RelationManagers\OrdersRelationManager::class,
            CustomerResource\RelationManagers\UserRelationManager::class,
        ];
    }

    public static function getPages(): array
    {
        return [
            'index' => Pages\ListCustomers::route('/'),
            'create' => Pages\CreateCustomer::route('/create'),
            'view' => Pages\ViewCustomer::route('/{record}'),
            'edit' => Pages\EditCustomer::route('/{record}/edit'),
        ];
    }
}
