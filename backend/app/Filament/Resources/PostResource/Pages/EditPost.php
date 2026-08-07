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

    protected function mutateFormDataBeforeFill(array $data): array
    {
        $data['metadata'] = $this->record->getAllMeta()->toArray();
        $data['seo'] = $this->record->seo?->only([
            'title', 'keyphrase', 'description', 'og_title', 'og_description', 'og_image',
        ]) ?? [];

        return $data;
    }

    protected function afterSave(): void
    {
        $metadata = $this->data['metadata'] ?? [];

        // Remove existing meta that's not in the new list
        $this->record->metadata()->whereNotIn('key', array_keys($metadata))->delete();

        foreach ($metadata as $key => $value) {
            $this->record->setMeta($key, $value, match (true) {
                is_array($value) => 'json',
                is_bool($value) => 'bool',
                default => 'string',
            });
        }

        $seo = $this->data['seo'] ?? [];
        $this->record->seo()->updateOrCreate([], [
            'title' => $seo['title'] ?? null,
            'keyphrase' => $seo['keyphrase'] ?? null,
            'description' => $seo['description'] ?? null,
            'og_title' => $seo['og_title'] ?? null,
            'og_description' => $seo['og_description'] ?? null,
            'og_image' => $seo['og_image'] ?? null,
        ]);
    }

    protected function getHeaderActions(): array
    {
        return [
            Actions\DeleteAction::make(),
        ];
    }
}
