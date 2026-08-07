<?php

namespace App\Filament\Resources\CustomerResource\RelationManagers;

use Filament\Tables;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Model;
use Lunar\Admin\Filament\Resources\CustomerResource\RelationManagers\AddressRelationManager as BaseAddressRelationManager;

class AddressRelationManager extends BaseAddressRelationManager
{
    public static function getTitle(Model $ownerRecord, string $pageClass): string
    {
        return __('Saved Address');
    }

    public function getDefaultTable(Table $table): Table
    {
        return parent::getDefaultTable($table)
            ->heading(__('Saved Address'))
            ->columns([
                Tables\Columns\TextColumn::make('title')->label(__('Title')),
                Tables\Columns\TextColumn::make('first_name')->label(__('First Name')),
                Tables\Columns\TextColumn::make('last_name')->label(__('Last Name')),
                Tables\Columns\TextColumn::make('line_one')
                    ->label(__('Address'))
                    ->description(function (Model $record) {
                        if (! $record->line_two && $record->line_three) {
                            return $record->line_three;
                        }
                        if (! $record->line_three) {
                            return $record->line_two;
                        }

                        return "{$record->line_two}, {$record->line_three}";
                    }),
                Tables\Columns\TextColumn::make('city')->label(__('City')),
                Tables\Columns\TextColumn::make('state')->label(__('State')),
                Tables\Columns\TextColumn::make('postcode')->label(__('Postcode')),
                Tables\Columns\TextColumn::make('contact_phone')->label(__('Contact Phone')),
            ]);
    }
}
