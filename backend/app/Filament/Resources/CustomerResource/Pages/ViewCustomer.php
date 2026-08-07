<?php

namespace App\Filament\Resources\CustomerResource\Pages;

use App\Filament\Resources\CustomerResource;
use Filament\Infolists;
use Filament\Infolists\Infolist;
use Lunar\Admin\Filament\Resources\CustomerResource\Pages\ViewCustomer as BaseViewCustomer;

class ViewCustomer extends BaseViewCustomer
{
    protected static string $resource = CustomerResource::class;

    public function infolist(Infolist $infolist): Infolist
    {
        return $infolist->schema([
            Infolists\Components\Section::make(__('Customer Details'))
                ->schema([
                    Infolists\Components\TextEntry::make('full_name')
                        ->label(__('Full Name'))
                        ->state(fn ($record) => trim(collect([$record->title, $record->first_name, $record->last_name])->filter()->implode(' ')) ?: '—'),
                    Infolists\Components\TextEntry::make('account_ref')
                        ->label(__('Account Reference'))
                        ->default('—'),
                    Infolists\Components\TextEntry::make('company_name')
                        ->label(__('Company Name'))
                        ->default('—'),
                    Infolists\Components\TextEntry::make('tax_identifier')
                        ->label(__('Tax ID'))
                        ->default('—'),
                    Infolists\Components\TextEntry::make('email')
                        ->label(__('Email'))
                        ->state(fn ($record) => $record->users->first()?->email ?? '—'),
                    Infolists\Components\TextEntry::make('phone')
                        ->label(__('Phone'))
                        ->state(fn ($record) => (
                            $record->addresses->firstWhere('shipping_default', true)
                                ?? $record->addresses->firstWhere('billing_default', true)
                                ?? $record->addresses->first()
                        )?->contact_phone ?? '—'),
                    Infolists\Components\TextEntry::make('customerGroups.name')
                        ->label(__('Customer Groups'))
                        ->badge()
                        ->default('—')
                        ->columnSpanFull(),
                ])->columns(2),
        ]);
    }
}
