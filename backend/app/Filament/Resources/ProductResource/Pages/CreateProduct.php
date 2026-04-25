<?php

namespace App\Filament\Resources\ProductResource\Pages;

use App\Filament\Resources\ProductResource;
use App\Services\ProductSyncService;
use Filament\Resources\Pages\CreateRecord;

class CreateProduct extends CreateRecord
{
    protected static string $resource = ProductResource::class;

    protected function afterCreate(): void
    {
        $metadata = $this->data['metadata'] ?? [];

        foreach ($metadata as $key => $value) {
            $this->record->setMeta($key, $value);
        }

        app(ProductSyncService::class)->syncFromLegacy($this->record);
    }
}
