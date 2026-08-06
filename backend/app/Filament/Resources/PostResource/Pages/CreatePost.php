<?php

namespace App\Filament\Resources\PostResource\Pages;

use App\Filament\Resources\PostResource;
use Filament\Resources\Pages\CreateRecord;

class CreatePost extends CreateRecord
{
    protected static string $resource = PostResource::class;

    protected function getRedirectUrl(): string
    {
        return $this->getResource()::getUrl('index');
    }

    protected function afterCreate(): void
    {
        $metadata = $this->data['metadata'] ?? [];

        foreach ($metadata as $key => $value) {
            $this->record->setMeta($key, $value, match (true) {
                is_array($value) => 'json',
                is_bool($value) => 'bool',
                default => 'string',
            });
        }
    }
}
