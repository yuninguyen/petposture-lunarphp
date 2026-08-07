<?php

namespace App\Filament\Resources\MediaResource\Pages;

use App\Filament\Resources\MediaResource;
use App\Models\MediaFolder;
use Filament\Notifications\Notification;
use Filament\Resources\Pages\ListRecords;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Livewire\Attributes\Url;
use Spatie\MediaLibrary\MediaCollections\Models\Media;
use Symfony\Component\HttpFoundation\StreamedResponse;
use ZipArchive;

class ListMedia extends ListRecords
{
    protected static string $resource = MediaResource::class;

    protected static string $view = 'filament.resources.media-resource.pages.list-media';

    #[Url(as: 'folder', keep: false)]
    public string $activeCollection = 'all';

    public string $search = '';

    public string $view_mode = 'grid';

    protected const SYSTEM_FOLDER_LABELS = [
        'product-images' => 'Product Images',
        'variant-images' => 'Variant Images',
        'banner' => 'Banner',
        'blog' => 'Blog',
        'general' => 'General',
    ];

    public const SCOPE_RECENT = '__recent__';

    public const SCOPE_STARRED = '__starred__';

    public function getTitle(): string
    {
        return __('File Manager');
    }

    public function getSubheading(): ?string
    {
        return __('Manage your files and folders');
    }

    protected function getHeaderActions(): array
    {
        return [];
    }

    public function uploadUrl(): string
    {
        $isRealFolder = ! in_array($this->activeCollection, ['all', self::SCOPE_RECENT, self::SCOPE_STARRED], true);

        return $isRealFolder
            ? MediaResource::getUrl('create', ['collection' => $this->activeCollection])
            : MediaResource::getUrl('create');
    }

    public function setCollection(string $collection): void
    {
        $this->activeCollection = $collection;
    }

    public function setViewMode(string $mode): void
    {
        $this->view_mode = $mode;
    }

    public function folderShareUrl(string $collection): string
    {
        return MediaResource::getUrl('index', ['folder' => $collection]);
    }

    public function createFolder(string $name): void
    {
        $name = trim($name);
        $slug = Str::slug($name);

        if ($slug === '' || $slug === 'all') {
            Notification::make()->title(__('Invalid folder name'))->danger()->send();

            return;
        }

        if (MediaFolder::where('slug', $slug)->exists() || Media::where('collection_name', $slug)->exists()) {
            Notification::make()->title(__('A folder with that name already exists'))->danger()->send();

            return;
        }

        MediaFolder::create(['name' => $name, 'slug' => $slug]);

        Notification::make()->title(__('Folder created'))->success()->send();
    }

    public function renameFolder(int $folderId, string $name): void
    {
        $folder = MediaFolder::findOrFail($folderId);
        $folder->update(['name' => $name]);

        Notification::make()->title(__('Folder renamed'))->success()->send();
    }

    public function deleteFolder(int $folderId): void
    {
        $folder = MediaFolder::findOrFail($folderId);

        if (Media::where('collection_name', $folder->slug)->exists()) {
            Notification::make()
                ->title(__('Folder is not empty'))
                ->body(__('Move or delete its files before deleting the folder.'))
                ->danger()
                ->send();

            return;
        }

        $folder->delete();

        if ($this->activeCollection === $folder->slug) {
            $this->activeCollection = 'all';
        }

        Notification::make()->title(__('Folder deleted'))->success()->send();
    }

    public function toggleFolderStar(int $folderId): void
    {
        $folder = MediaFolder::findOrFail($folderId);
        $folder->update(['starred' => ! $folder->starred]);
    }

    public function toggleFileStar(int $mediaId): void
    {
        $media = Media::query()->findOrFail($mediaId);
        $media->setCustomProperty('starred', ! $media->getCustomProperty('starred', false));
        $media->save();
    }

    public function downloadFolder(string $collection): StreamedResponse
    {
        $files = Media::query()->where('collection_name', $collection)->get();

        $tmpPath = tempnam(sys_get_temp_dir(), 'folder').'.zip';
        $zip = new ZipArchive;
        $zip->open($tmpPath, ZipArchive::CREATE | ZipArchive::OVERWRITE);

        foreach ($files as $file) {
            $zip->addFile($file->getPath(), $file->file_name);
        }

        $zip->close();

        $folderName = MediaFolder::where('slug', $collection)->value('name')
            ?? (self::SYSTEM_FOLDER_LABELS[$collection] ?? $collection);

        return response()->streamDownload(function () use ($tmpPath) {
            echo file_get_contents($tmpPath);
            @unlink($tmpPath);
        }, Str::slug($folderName).'.zip');
    }

    public function deleteMedia(int $mediaId): void
    {
        Media::query()->findOrFail($mediaId)->delete();

        Notification::make()
            ->title('File deleted')
            ->success()
            ->send();
    }

    public function getStorageStats(): array
    {
        $totalBytes = (int) Media::query()->sum('size');
        $count = Media::query()->count();

        $disk = config('filament.default_filesystem_disk', 'public');
        $diskPath = Storage::disk($disk)->path('');
        $freeBytes = @disk_free_space($diskPath);
        $capacityBytes = @disk_total_space($diskPath);

        return [
            'count' => $count,
            'used_human' => $this->humanSize($totalBytes),
            'free_human' => $freeBytes !== false ? $this->humanSize($freeBytes) : null,
            'capacity_human' => $capacityBytes !== false ? $this->humanSize($capacityBytes) : null,
            'percent' => ($capacityBytes && $capacityBytes > 0) ? round((($capacityBytes - $freeBytes) / $capacityBytes) * 100, 1) : null,
        ];
    }

    public function getFolders()
    {
        $counts = Media::query()
            ->selectRaw('collection_name, count(*) as aggregate')
            ->groupBy('collection_name')
            ->pluck('aggregate', 'collection_name');

        $customFolders = MediaFolder::query()->orderBy('name')->get()->map(fn (MediaFolder $folder) => [
            'id' => $folder->id,
            'key' => $folder->slug,
            'label' => $folder->name,
            'count' => $counts[$folder->slug] ?? 0,
            'is_custom' => true,
            'starred' => $folder->starred,
            'created_at' => $folder->created_at,
        ])->toBase();

        if ($this->activeCollection === self::SCOPE_STARRED) {
            return $customFolders->where('starred', true)->values();
        }

        if ($this->activeCollection === self::SCOPE_RECENT) {
            return collect();
        }

        $customKeys = $customFolders->pluck('key');

        $systemFolders = collect(self::SYSTEM_FOLDER_LABELS)
            ->reject(fn ($label, $key) => $customKeys->contains($key))
            ->map(fn ($label, $key) => [
                'id' => null,
                'key' => $key,
                'label' => $label,
                'count' => $counts[$key] ?? 0,
                'is_custom' => false,
                'starred' => false,
                'created_at' => null,
            ])
            ->values()
            ->merge(
                $counts->except($customKeys->merge(array_keys(self::SYSTEM_FOLDER_LABELS)))->map(fn ($count, $key) => [
                    'id' => null,
                    'key' => $key,
                    'label' => str($key)->headline()->toString(),
                    'count' => $count,
                    'is_custom' => false,
                    'starred' => false,
                    'created_at' => null,
                ])->values()
            );

        return $customFolders->merge($systemFolders);
    }

    public function getFiles()
    {
        if ($this->activeCollection === self::SCOPE_RECENT) {
            return Media::query()
                ->when($this->search !== '', fn ($query) => $query->where('file_name', 'like', "%{$this->search}%"))
                ->latest('id')
                ->limit(20)
                ->get();
        }

        if ($this->activeCollection === self::SCOPE_STARRED) {
            return Media::query()
                ->where('custom_properties->starred', true)
                ->when($this->search !== '', fn ($query) => $query->where('file_name', 'like', "%{$this->search}%"))
                ->latest('id')
                ->limit(60)
                ->get();
        }

        return Media::query()
            ->when($this->activeCollection !== 'all', fn ($query) => $query->where('collection_name', $this->activeCollection))
            ->when($this->search !== '', fn ($query) => $query->where('file_name', 'like', "%{$this->search}%"))
            ->latest('id')
            ->limit(60)
            ->get();
    }

    private function humanSize(int|float $bytes): string
    {
        if ($bytes <= 0) {
            return '0 B';
        }

        $units = ['B', 'KB', 'MB', 'GB', 'TB'];
        $power = min((int) floor(log($bytes, 1024)), count($units) - 1);

        return round($bytes / (1024 ** $power), 1).' '.$units[$power];
    }
}
