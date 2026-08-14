<?php

namespace App\Filament\Resources\PostResource\Pages;

use App\Filament\Resources\PostResource;
use App\Models\Post;
use Filament\Actions;
use Filament\Notifications\Notification;
use Filament\Resources\Pages\EditRecord;

class EditPost extends EditRecord
{
    protected static string $resource = PostResource::class;

    protected function getRedirectUrl(): string
    {
        return $this->getResource()::getUrl('index');
    }

    protected function mutateFormDataBeforeSave(array $data): array
    {
        $data['read_time'] = Post::estimateReadTime($data['content'] ?? '');

        return $data;
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
        $ogImage = $seo['og_image'] ?? null;

        if (is_array($ogImage)) {
            $ogImage = $ogImage[array_key_first($ogImage)] ?? null;
        }

        $this->record->seo()->updateOrCreate([], [
            'title' => $seo['title'] ?? null,
            'keyphrase' => $seo['keyphrase'] ?? null,
            'description' => $seo['description'] ?? null,
            'og_title' => $seo['og_title'] ?? null,
            'og_description' => $seo['og_description'] ?? null,
            'og_image' => $ogImage,
        ]);

        if ($this->record->status === 'published') {
            $warnings = $this->record->refresh()->publishChecklistWarnings();

            if ($warnings) {
                Notification::make()
                    ->title(__('Saved — but a few things could use attention'))
                    ->body('• '.implode("\n• ", $warnings))
                    ->warning()
                    ->send();
            }
        }
    }

    protected function getHeaderActions(): array
    {
        return [
            Actions\DeleteAction::make(),
        ];
    }

    protected function getSaveFormAction(): Actions\Action
    {
        return parent::getSaveFormAction()
            ->label(fn () => ($this->data['status'] ?? 'draft') === 'published' ? __('Update & Publish') : __('Save Draft'))
            ->extraAttributes(['onclick' => "localStorage.removeItem('petposture-draft:' + window.location.pathname)"]);
    }
}
