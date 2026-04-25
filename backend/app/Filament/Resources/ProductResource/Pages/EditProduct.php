<?php

namespace App\Filament\Resources\ProductResource\Pages;

use App\Filament\Resources\ProductResource;
use App\Services\ProductSyncService;
use Filament\Actions;
use Filament\Resources\Pages\EditRecord;

class EditProduct extends EditRecord
{
    protected static string $resource = ProductResource::class;

    protected function afterSave(): void
    {
        $metadata = $this->data['metadata'] ?? [];

        // Remove existing meta that's not in the new list
        $this->record->metadata()->whereNotIn('key', array_keys($metadata))->delete();

        foreach ($metadata as $key => $value) {
            $this->record->setMeta($key, $value);
        }

        app(ProductSyncService::class)->syncFromLegacy($this->record);
    }

    protected function getHeaderActions(): array
    {
        return [
            Actions\DeleteAction::make(),
        ];
    }
}
