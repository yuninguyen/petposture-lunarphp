<?php

namespace App\Filament\Resources\PostResource\Pages;

use App\Filament\Resources\PostResource;
use Filament\Actions;
use Filament\Resources\Pages\EditRecord;

class EditPost extends EditRecord
{
    protected static string $resource = PostResource::class;

    protected function getRedirectUrl(): string
    {
        return $this->getResource()::getUrl('index');
    }

    protected function afterSave(): void
    {
        $metadata = $this->data['metadata'] ?? [];

        // Remove existing meta that's not in the new list
        $this->record->metadata()->whereNotIn('key', array_keys($metadata))->delete();

        foreach ($metadata as $key => $value) {
            $this->record->setMeta($key, $value);
        }
    }

    protected function getHeaderActions(): array
    {
        return [
            Actions\DeleteAction::make(),
        ];
    }
}
