<?php

namespace App\Filament\Resources\PostResource\Pages;

use App\Filament\Resources\PostResource;
use App\Models\Post;
use Filament\Actions\Action;
use Filament\Resources\Pages\CreateRecord;

class CreatePost extends CreateRecord
{
    protected static string $resource = PostResource::class;

    protected function getRedirectUrl(): string
    {
        return $this->getResource()::getUrl('index');
    }

    protected function mutateFormDataBeforeCreate(array $data): array
    {
        $data['read_time'] = Post::estimateReadTime($data['content'] ?? '');

        return $data;
    }

    protected function getCreateFormAction(): Action
    {
        return parent::getCreateFormAction()
            ->label(__('Publish'))
            ->icon('heroicon-o-paper-airplane')
            ->extraAttributes(['onclick' => "localStorage.removeItem('petposture-draft:' + window.location.pathname)"]);
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

        $seo = $this->data['seo'] ?? [];

        if (array_filter($seo)) {
            $this->record->seo()->create([
                'title' => $seo['title'] ?? null,
                'keyphrase' => $seo['keyphrase'] ?? null,
                'description' => $seo['description'] ?? null,
                'og_title' => $seo['og_title'] ?? null,
                'og_description' => $seo['og_description'] ?? null,
                'og_image' => $seo['og_image'] ?? null,
            ]);
        }
    }
}
