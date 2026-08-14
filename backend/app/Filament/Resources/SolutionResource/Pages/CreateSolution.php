<?php

namespace App\Filament\Resources\SolutionResource\Pages;

use App\Filament\Resources\SolutionResource;
use Filament\Resources\Pages\CreateRecord;

class CreateSolution extends CreateRecord
{
    protected static string $resource = SolutionResource::class;

    protected function getRedirectUrl(): string
    {
        return $this->getResource()::getUrl('index');
    }
}
