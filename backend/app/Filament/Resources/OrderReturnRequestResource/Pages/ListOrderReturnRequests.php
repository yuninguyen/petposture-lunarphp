<?php

namespace App\Filament\Resources\OrderReturnRequestResource\Pages;

use App\Filament\Resources\OrderReturnRequestResource;
use Filament\Resources\Pages\ListRecords;

class ListOrderReturnRequests extends ListRecords
{
    protected static string $resource = OrderReturnRequestResource::class;

    protected function getHeaderActions(): array
    {
        return [];
    }
}
