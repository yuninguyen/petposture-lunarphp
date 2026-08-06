<?php

namespace App\Filament\Pages;

use App\Models\Setting;
use Filament\Forms\Components\Grid;
use Filament\Forms\Components\TextInput;
use Filament\Forms\Form;
use Filament\Notifications\Notification;
use Filament\Pages\Page;

class SeoSocial extends Page
{
    protected static ?string $navigationIcon = 'heroicon-o-globe-alt';

    protected static ?string $navigationLabel = 'SEO & Social';

    protected static string $view = 'filament.pages.seo-social';

    protected static ?int $navigationSort = 5;

    public static function getNavigationGroup(): ?string
    {
        return __('Content Management');
    }

    public function getTitle(): string
    {
        return __('SEO & Social');
    }

    public ?array $data = [];

    public function mount(): void
    {
        $data = [];
        foreach (Setting::all() as $setting) {
            $data[$setting->key] = $setting->value;
        }

        $this->form->fill($data);
    }

    public function form(Form $form): Form
    {
        return $form
            ->schema([
                Grid::make(2)->schema([
                    TextInput::make('social_facebook')
                        ->label(__('Facebook URL'))
                        ->url()
                        ->placeholder('https://facebook.com/yourpage'),
                    TextInput::make('social_instagram')
                        ->label(__('Instagram URL'))
                        ->url()
                        ->placeholder('https://instagram.com/yourpage'),
                    TextInput::make('social_twitter')
                        ->label(__('Twitter / X URL'))
                        ->url()
                        ->placeholder('https://x.com/yourpage'),
                    TextInput::make('social_tiktok')
                        ->label(__('TikTok URL'))
                        ->url()
                        ->placeholder('https://tiktok.com/@yourpage'),
                    TextInput::make('social_pinterest')
                        ->label(__('Pinterest URL'))
                        ->url()
                        ->placeholder('https://pinterest.com/yourpage'),
                    TextInput::make('social_youtube')
                        ->label(__('YouTube URL'))
                        ->url()
                        ->placeholder('https://youtube.com/@yourpage'),
                ]),
                Grid::make(2)->schema([
                    TextInput::make('business_phone')
                        ->label(__('Business Phone'))
                        ->tel(),
                    TextInput::make('business_address')
                        ->label(__('Business Address'))
                        ->helperText('Used for search engine business info (Organization schema).'),
                ]),
            ])
            ->statePath('data');
    }

    public function save(): void
    {
        $data = $this->form->getState();

        foreach ($data as $key => $value) {
            if ($value === null || $value === '') {
                continue;
            }

            Setting::updateOrCreate(
                ['key' => $key],
                [
                    'value' => $value,
                    'type' => 'string',
                    'group' => 'seo_social',
                ]
            );
        }

        Notification::make()
            ->title(__('SEO & Social settings saved!'))
            ->success()
            ->send();
    }
}
