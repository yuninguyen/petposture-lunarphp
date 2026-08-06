<?php

namespace App\Filament\Resources\AffiliateNetworkResource\Pages;

use App\Filament\Resources\AffiliateNetworkResource;
use Filament\Actions;
use Filament\Resources\Pages\ListRecords;

class ListAffiliateNetworks extends ListRecords
{
    protected static string $resource = AffiliateNetworkResource::class;

    protected function getHeaderActions(): array
    {
        return [
            Actions\CreateAction::make(),
        ];
    }
}
