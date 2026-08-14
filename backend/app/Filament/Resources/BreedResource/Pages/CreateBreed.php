<?php

namespace App\Filament\Resources\BreedResource\Pages;

use App\Filament\Resources\BreedResource;
use Filament\Resources\Pages\CreateRecord;

class CreateBreed extends CreateRecord
{
    protected static string $resource = BreedResource::class;

    protected function getRedirectUrl(): string
    {
        return $this->getResource()::getUrl('index');
    }
}
