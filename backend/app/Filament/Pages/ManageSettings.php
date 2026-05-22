<?php

namespace App\Filament\Pages;

use App\Models\Setting;
use Filament\Forms\Components\Grid;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\Tabs;
use Filament\Forms\Components\TextInput;
use Filament\Forms\Components\FileUpload;
use Filament\Forms\Components\Textarea;
use Filament\Forms\Components\Toggle;
use Filament\Forms\Form;
use Filament\Pages\Page;
use Filament\Notifications\Notification;
use Illuminate\Support\Facades\Cache;

class ManageSettings extends Page
{
    protected static ?string $navigationIcon = 'heroicon-o-cog-6-tooth';

    public static function getNavigationGroup(): ?string
    {
        return __('System');
    }

    public function getTitle(): string
    {
        return __('admin.navigation.manage_settings');
    }

    public static function getNavigationLabel(): string
    {
        return __('admin.navigation.manage_settings');
    }

    protected static string $view = 'filament.pages.manage-settings';

    public ?array $data = [];

    public function mount(): void
    {
        $data = [];
        foreach (Setting::all() as $setting) {
            $data[$setting->key] = $setting->value;
        }

        // Fallback to .env for Stripe if not in DB yet
        $data['stripe_key']            ??= config('services.stripe.key');
        $data['stripe_secret']         ??= config('services.stripe.secret');
        $data['stripe_webhook_secret'] ??= config('services.stripe.webhook_secret');
        $data['stripe_mode']           ??= 'live';

        $this->form->fill($data);
    }

    public function form(Form $form): Form
    {
        return $form
            ->schema([
                Tabs::make('Settings')
                    ->tabs([

                        // ── General ──────────────────────────────────────────
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

                        // ── Payment / Stripe ──────────────────────────────────
                        Tabs\Tab::make(__('Payment'))
                            ->icon('heroicon-o-credit-card')
                            ->schema([
                                Select::make('stripe_mode')
                                    ->label(__('Stripe Mode'))
                                    ->options([
                                        'test' => 'Test (Sandbox)',
                                        'live' => 'Live (Production)',
                                    ])
                                    ->required()
                                    ->helperText('Switch to Test to use Stripe test cards without real charges.'),

                                Grid::make(2)->schema([
                                    TextInput::make('stripe_key')
                                        ->label(__('Publishable Key'))
                                        ->placeholder('pk_live_...')
                                        ->helperText('Starts with pk_live_ or pk_test_'),

                                    TextInput::make('stripe_secret')
                                        ->label(__('Secret Key'))
                                        ->password()
                                        ->revealable()
                                        ->placeholder('sk_live_...')
                                        ->helperText('Starts with sk_live_ or sk_test_'),
                                ]),

                                TextInput::make('stripe_webhook_secret')
                                    ->label(__('Webhook Signing Secret'))
                                    ->password()
                                    ->revealable()
                                    ->placeholder('whsec_...')
                                    ->helperText('From Stripe Dashboard → Developers → Webhooks → your endpoint → Signing secret.')
                                    ->columnSpanFull(),

                                TextInput::make('webhook_url')
                                    ->label('Webhook Endpoint URL')
                                    ->default(fn () => url('/api/webhooks/stripe'))
                                    ->disabled()
                                    ->dehydrated(false)
                                    ->suffixAction(
                                        \Filament\Forms\Components\Actions\Action::make('copy')
                                            ->icon('heroicon-o-clipboard-document')
                                            ->tooltip('Copy to clipboard')
                                            ->action(fn () => null)
                                            ->extraAttributes([
                                                'x-on:click' => 'navigator.clipboard.writeText($el.closest(\'.fi-input-wrp\').querySelector(\'input\').value); $tooltip(\'Copied!\', { timeout: 1500 })',
                                            ])
                                    )
                                    ->helperText('Register this URL in your Stripe Dashboard → Developers → Webhooks.'),
                            ]),

                        // ── SMTP ─────────────────────────────────────────────
                        Tabs\Tab::make(__('SMTP Settings'))
                            ->icon('heroicon-o-envelope')
                            ->schema([
                                Grid::make(2)->schema([
                                    TextInput::make('smtp_host')
                                        ->label(__('SMTP Host'))
                                        ->placeholder('smtp.resend.com'),
                                    TextInput::make('smtp_port')
                                        ->label(__('SMTP Port'))
                                        ->numeric()
                                        ->placeholder('465'),
                                    TextInput::make('smtp_user')
                                        ->label(__('SMTP Username')),
                                    TextInput::make('smtp_pass')
                                        ->label(__('SMTP Password'))
                                        ->password()
                                        ->revealable(),
                                    Select::make('smtp_encryption')
                                        ->label(__('Encryption'))
                                        ->options([
                                            'tls'  => 'TLS',
                                            'ssl'  => 'SSL',
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
            if ($value === null || $value === '') {
                continue;
            }

            Setting::updateOrCreate(
                ['key' => $key],
                [
                    'value' => $value,
                    'type'  => $this->guessType($value),
                    'group' => $this->guessGroup($key),
                ]
            );
        }

        Cache::forget('stripe_key');
        Cache::forget('stripe_secret');
        Cache::forget('stripe_webhook_secret');

        Notification::make()
            ->title('Settings saved successfully!')
            ->success()
            ->send();
    }

    protected function guessType(mixed $value): string
    {
        if (is_bool($value)) return 'bool';
        if (is_array($value)) return 'json';
        if (is_numeric($value)) return 'int';
        return 'string';
    }

    protected function guessGroup(string $key): string
    {
        if (str_starts_with($key, 'smtp_') || $key === 'mail_from_address') return 'email';
        if (str_starts_with($key, 'stripe_')) return 'payment';
        return 'general';
    }
}
