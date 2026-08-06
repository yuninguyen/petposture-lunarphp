<?php

namespace App\Filament\Resources;

use App\Filament\Resources\UserAddressResource\Pages;
use App\Models\User;
use App\Models\UserAddress;
use Filament\Resources\Resource;
use Filament\Tables;
use Filament\Tables\Table;

class UserAddressResource extends Resource
{
    protected static ?string $model = UserAddress::class;

    protected static ?string $navigationIcon = 'heroicon-o-map-pin';

    protected static ?int $navigationSort = 4;

    public static function getNavigationGroup(): ?string
    {
        return __('System');
    }

    public static function getLabel(): string
    {
        return __('Saved Address');
    }

    public static function getPluralLabel(): string
    {
        return __('Saved Addresses');
    }

    public static function shouldRegisterNavigation(): bool
    {
        return false;
    }

    public static function table(Table $table): Table
    {
        return $table
            ->columns([
                Tables\Columns\TextColumn::make('user.name')
                    ->label(__('Customer'))
                    ->searchable()
                    ->sortable(),
                Tables\Columns\TextColumn::make('user.email')
                    ->label(__('Email'))
                    ->searchable(),
                Tables\Columns\TextColumn::make('label')
                    ->label(__('Label'))
                    ->badge(),
                Tables\Columns\TextColumn::make('full_name')
                    ->label(__('Name'))
                    ->getStateUsing(fn (UserAddress $record) => trim("{$record->first_name} {$record->last_name}")),
                Tables\Columns\TextColumn::make('line_one')
                    ->label(__('Address'))
                    ->description(fn (UserAddress $record) => trim("{$record->city}, {$record->state} {$record->postcode}"))
                    ->searchable(),
                Tables\Columns\IconColumn::make('is_default')
                    ->label(__('Default'))
                    ->boolean(),
                Tables\Columns\TextColumn::make('created_at')
                    ->label(__('Saved'))
                    ->dateTime()
                    ->sortable(),
            ])
            ->filters([
                Tables\Filters\SelectFilter::make('user_id')
                    ->label(__('Customer'))
                    ->options(fn () => User::query()->whereHas('addresses')->pluck('email', 'id'))
                    ->searchable(),
            ])
            ->defaultSort('created_at', 'desc')
            ->actions([
                Tables\Actions\DeleteAction::make(),
            ])
            ->bulkActions([
                Tables\Actions\BulkActionGroup::make([
                    Tables\Actions\DeleteBulkAction::make(),
                ]),
            ]);
    }

    public static function getPages(): array
    {
        return [
            'index' => Pages\ListUserAddresses::route('/'),
        ];
    }
}
