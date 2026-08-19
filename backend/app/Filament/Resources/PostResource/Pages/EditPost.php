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

    protected function mutateFormDataBeforeSave(array $data): array
    {
        $data['read_time'] = Post::estimateReadTime($data['content'] ?? '');

        if (($data['status'] ?? null) === 'published' && empty($data['published_at'])) {
            $data['published_at'] = now();
        }

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
            Actions\Action::make('preview')
                ->label(__('Preview'))
                ->icon('heroicon-o-eye')
                ->color('gray')
                ->url(fn (): string => $this->getPreviewUrl())
                ->openUrlInNewTab(),
            Actions\Action::make('headerSave')
                ->label(fn () => ($this->data['status'] ?? 'draft') === 'published' ? __('Update & Publish') : __('Save Draft'))
                ->icon(fn () => ($this->data['status'] ?? 'draft') === 'published' ? 'heroicon-o-paper-airplane' : 'heroicon-o-document')
                ->action(fn () => $this->save()),
            Actions\DeleteAction::make(),
        ];
    }

    protected function getPreviewUrl(): string
    {
        $slug = $this->record->slug;
        $expires = now()->addDay()->timestamp;
        $token = hash_hmac('sha256', $slug.'|'.$expires, config('app.key'));

        return rtrim(config('app.frontend_url'), '/')."/blog/{$slug}?expires={$expires}&preview_token={$token}";
    }

    protected function getSaveFormAction(): Actions\Action
    {
        return parent::getSaveFormAction()
            ->label(fn () => ($this->data['status'] ?? 'draft') === 'published' ? __('Update & Publish') : __('Save Draft'));
    }
}
