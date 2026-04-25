<?php

namespace App\Filament\Pages;

use App\Models\Setting;
use Filament\Forms\Components\Section;
use Filament\Forms\Components\TextInput;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\Grid;
use Filament\Forms\Components\Tabs;
use Filament\Forms\Components\FileUpload;
use Filament\Forms\Components\Textarea;
use Filament\Forms\Form;
use Filament\Pages\Page;
use Filament\Notifications\Notification;
use Illuminate\Support\Facades\Artisan;

class ManageSettings extends Page
{
    protected static ?string $navigationIcon = 'heroicon-o-cog-6-tooth';

    protected static ?string $navigationGroup = 'Settings';

    protected static ?string $title = 'Manage Settings';

    protected static string $view = 'filament.pages.manage-settings';

    public ?array $data = [];

    public function mount(): void
    {
        // Load settings from database
        $settings = Setting::all();

        $data = [];
        foreach ($settings as $setting) {
            $data[$setting->key] = $setting->value;
        }

        $this->form->fill($data);
    }

    public function form(Form $form): Form
    {
        return $form
            ->schema([
                Tabs::make('Settings')
                    ->tabs([
                        Tabs\Tab::make(__('General'))
                            ->icon('heroicon-o-cog')
                            ->schema([
                                TextInput::make('shop_name')
                                    ->label(__('Shop Name'))
                                    ->required(),
                                FileUpload::make('shop_logo')
                                    ->label(__('Shop Logo'))
                                    ->image()
                                    ->directory('settings'),
                                Textarea::make('shop_description')
                                    ->label(__('Shop Description'))
                                    ->rows(3),
                            ]),

                        Tabs\Tab::make(__('Localization'))
                            ->icon('heroicon-o-globe-alt')
                            ->schema([
                                Select::make('default_currency')
                                    ->label(__('Currency'))
                                    ->options([
                                        'USD' => 'USD ($)',
                                        'VND' => 'VND (đ)',
                                        'EUR' => 'EUR (€)',
                                    ])
                                    ->required(),
                                TextInput::make('currency_symbol')
                                    ->label(__('Currency Symbol'))
                                    ->default('$'),
                            ])->columns(2),

                        Tabs\Tab::make(__('SMTP Settings'))
                            ->icon('heroicon-o-envelope')
                            ->schema([
                                Grid::make(2)
                                    ->schema([
                                        TextInput::make('smtp_host')
                                            ->label(__('SMTP Host'))
                                            ->placeholder('smtp.mailtrap.io'),
                                        TextInput::make('smtp_port')
                                            ->label(__('SMTP Port'))
                                            ->numeric()
                                            ->placeholder('2525'),
                                        TextInput::make('smtp_user')
                                            ->label(__('SMTP Username')),
                                        TextInput::make('smtp_pass')
                                            ->label(__('SMTP Password'))
                                            ->password()
                                            ->revealable(),
                                        Select::make('smtp_encryption')
                                            ->label(__('Encryption'))
                                            ->options([
                                                'tls' => 'TLS',
                                                'ssl' => 'SSL',
                                                'none' => 'None',
                                            ]),
                                        TextInput::make('mail_from_address')
                                            ->label(__('Mail From Address'))
                                            ->email(),
                                    ]),
                            ]),
                    ])->columnSpanFull(),
            ])
            ->statePath('data');
    }

    public function save(): void
    {
        $data = $this->form->getState();

        foreach ($data as $key => $value) {
            Setting::updateOrCreate(
                ['key' => $key],
                [
                    'value' => $value,
                    'type' => $this->guessType($value),
                    'group' => $this->guessGroup($key),
                ]
            );
        }

        // Clear cache if you implement it later
        // Artisan::call('cache:clear');

        Notification::make()
            ->title('Settings saved successfully!')
            ->success()
            ->send();
    }

    protected function guessType($value): string
    {
        if (is_numeric($value))
            return 'int';
        if (is_bool($value))
            return 'bool';
        if (is_array($value))
            return 'json';
        return 'string';
    }

    protected function guessGroup($key): string
    {
        if (str_starts_with($key, 'smtp_'))
            return 'email';
        if (str_contains($key, 'currency'))
            return 'shop';
        return 'general';
    }
}
