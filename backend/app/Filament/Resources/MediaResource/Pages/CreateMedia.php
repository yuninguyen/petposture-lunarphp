<?php

namespace App\Filament\Resources\MediaResource\Pages;

use App\Filament\Resources\MediaResource;
use App\Models\SiteMedia;
use Filament\Forms\Components\FileUpload;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\TextInput;
use Filament\Forms\Form;
use Filament\Notifications\Notification;
use Filament\Resources\Pages\Page;

class CreateMedia extends Page
{
    protected static string $resource = MediaResource::class;

    protected static string $view = 'filament.resources.media-resource.pages.create-media';

    public ?array $data = [];

    public function mount(): void
    {
        $this->form->fill();
    }

    public function form(Form $form): Form
    {
        return $form
            ->schema([
                TextInput::make('title')
                    ->label('Title / Alt text')
                    ->placeholder('e.g. Homepage Banner')
                    ->columnSpanFull(),

                Select::make('collection')
                    ->label('Collection')
                    ->options([
                        'general' => 'General',
                        'banner'  => 'Banner',
                        'blog'    => 'Blog',
                    ])
                    ->default('general')
                    ->required(),

                FileUpload::make('files')
                    ->label('Files')
                    ->multiple()
                    ->image()
                    ->imageEditor()
                    ->acceptedFileTypes(['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml', 'image/gif'])
                    ->maxSize(10240)
                    ->columnSpanFull()
                    ->required(),
            ])
            ->columns(2)
            ->statePath('data');
    }

    public function save(): void
    {
        $data = $this->form->getState();

        $siteMedia = SiteMedia::create([
            'title'      => $data['title'] ?? null,
            'collection' => $data['collection'],
        ]);

        $disk = config('filesystems.default', 'public');

        foreach ($data['files'] as $path) {
            $fullPath = \Illuminate\Support\Facades\Storage::disk($disk)->path($path);
            $siteMedia
                ->addMedia($fullPath)
                ->usingName(pathinfo($path, PATHINFO_FILENAME))
                ->toMediaCollection($data['collection']);
        }

        Notification::make()
            ->title(count($data['files']) . ' file(s) uploaded successfully.')
            ->success()
            ->send();

        $this->redirect(MediaResource::getUrl('index'));
    }

    protected function getFormActions(): array
    {
        return [
            \Filament\Actions\Action::make('save')
                ->label('Upload')
                ->submit('save'),
        ];
    }
}
