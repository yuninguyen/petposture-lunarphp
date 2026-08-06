<?php

namespace App\Filament\Resources\AffiliateNetworkResource\Pages;

use App\Filament\Resources\AffiliateNetworkResource;
use Filament\Resources\Pages\CreateRecord;

class CreateAffiliateNetwork extends CreateRecord
{
    protected static string $resource = AffiliateNetworkResource::class;

    protected function getRedirectUrl(): string
    {
        return $this->getResource()::getUrl('index');
    }
}
