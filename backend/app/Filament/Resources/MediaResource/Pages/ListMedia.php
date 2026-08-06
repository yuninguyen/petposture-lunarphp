<?php

namespace App\Filament\Resources\MediaResource\Pages;

use App\Filament\Resources\MediaResource;
use Filament\Actions\CreateAction;
use Filament\Notifications\Notification;
use Filament\Resources\Pages\ListRecords;
use Illuminate\Support\Facades\Storage;
use Spatie\MediaLibrary\MediaCollections\Models\Media;

class ListMedia extends ListRecords
{
    protected static string $resource = MediaResource::class;

    protected static string $view = 'filament.resources.media-resource.pages.list-media';

    public string $activeCollection = 'all';

    public string $search = '';

    protected function getHeaderActions(): array
    {
        return [
            CreateAction::make()->label('Upload Files'),
        ];
    }

    public function setCollection(string $collection): void
    {
        $this->activeCollection = $collection;
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

        $labels = [
            'product-images' => 'Product Images',
            'variant-images' => 'Variant Images',
            'banner' => 'Banner',
            'general' => 'General',
        ];

        return collect($labels)
            ->map(fn ($label, $key) => [
                'key' => $key,
                'label' => $label,
                'count' => $counts[$key] ?? 0,
            ])
            ->merge(
                $counts->except(array_keys($labels))->map(fn ($count, $key) => [
                    'key' => $key,
                    'label' => str($key)->headline()->toString(),
                    'count' => $count,
                ])->values()
            );
    }

    public function getFiles()
    {
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
