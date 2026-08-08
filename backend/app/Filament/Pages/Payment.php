<?php

namespace App\Filament\Pages;

use App\Models\Setting;
use Filament\Forms\Components\Actions\Action as FormAction;
use Filament\Forms\Components\Grid;
use Filament\Forms\Components\Section;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\Tabs;
use Filament\Forms\Components\Textarea;
use Filament\Forms\Components\TextInput;
use Filament\Forms\Form;
use Filament\Notifications\Notification;
use Filament\Pages\Page;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;

class Payment extends Page
{
    protected static ?string $navigationIcon = 'heroicon-o-credit-card';

    protected static string $view = 'filament.pages.payment';

    public static function getNavigationGroup(): ?string
    {
        return __('Finance');
    }

    public function getTitle(): string
    {
        return __('Payment Methods');
    }

    public static function getNavigationLabel(): string
    {
        return __('Payment Methods');
    }

    public ?array $data = [];

    public function mount(): void
    {
        $data = [];
        foreach (Setting::all() as $setting) {
            $data[$setting->key] = $setting->value;
        }

        $data['stripe_key'] ??= config('services.stripe.key');
        $data['stripe_secret'] ??= config('services.stripe.secret');
        $data['stripe_webhook_secret'] ??= config('services.stripe.webhook_secret');
        $data['stripe_mode'] ??= 'live';
        $data['paypal_client_id'] ??= config('services.paypal.client_id');
        $data['paypal_client_secret'] ??= config('services.paypal.client_secret');
        $data['paypal_webhook_id'] ??= config('services.paypal.webhook_id');
        $data['paypal_mode'] ??= config('services.paypal.mode', 'sandbox');

        $data['airwallex_client_id'] ??= config('services.airwallex.client_id');
        $data['airwallex_api_key'] ??= config('services.airwallex.api_key');
        $data['airwallex_webhook_secret'] ??= config('services.airwallex.webhook_secret');
        $data['airwallex_mode'] ??= config('services.airwallex.mode', 'sandbox');

        $data['payoneer_merchant_code'] ??= config('services.payoneer.merchant_code');
        $data['payoneer_api_key'] ??= config('services.payoneer.api_key');
        $data['payoneer_api_secret'] ??= config('services.payoneer.api_secret');
        $data['payoneer_webhook_secret'] ??= config('services.payoneer.webhook_secret');
        $data['payoneer_mode'] ??= config('services.payoneer.mode', 'sandbox');

        $data['pingpong_app_id'] ??= config('services.pingpong.app_id');
        $data['pingpong_private_key'] ??= config('services.pingpong.private_key');
        $data['pingpong_public_key'] ??= config('services.pingpong.public_key');
        $data['pingpong_mode'] ??= config('services.pingpong.mode', 'sandbox');

        $this->form->fill($data);
    }

    public function testStripeConnection(): void
    {
        $secret = Setting::get('stripe_secret') ?: config('services.stripe.secret');

        if (! $secret) {
            Notification::make()
                ->title('Stripe secret key not set')
                ->body('Please enter your Stripe Secret Key in the Stripe tab.')
                ->warning()
                ->send();

            return;
        }

        try {
            $response = Http::withBasicAuth($secret, '')
                ->get('https://api.stripe.com/v1/account');

            if ($response->successful()) {
                $account = $response->json();
                Notification::make()
                    ->title('Stripe connected ✓')
                    ->body('Account: '.($account['email'] ?? $account['id'] ?? 'verified').' — Mode: '.(str_starts_with($secret, 'sk_test_') ? 'Test' : 'Live'))
                    ->success()
                    ->send();
            } else {
                Notification::make()
                    ->title('Stripe connection failed')
                    ->body($response->json('error.message') ?? 'Invalid API key or network error.')
                    ->danger()
                    ->send();
            }
        } catch (\Throwable $e) {
            Notification::make()
                ->title('Stripe connection error')
                ->body($e->getMessage())
                ->danger()
                ->send();
        }
    }

    public function testPayPalConnection(): void
    {
        $clientId = Setting::get('paypal_client_id') ?: config('services.paypal.client_id');
        $clientSecret = Setting::get('paypal_client_secret') ?: config('services.paypal.client_secret');
        $mode = Setting::get('paypal_mode') ?: config('services.paypal.mode', 'sandbox');

        if (! $clientId || ! $clientSecret) {
            Notification::make()
                ->title('PayPal credentials not set')
                ->body('Please enter your PayPal Client ID and Secret in the PayPal tab.')
                ->warning()
                ->send();

            return;
        }

        try {
            $baseUrl = $mode === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';

            $response = Http::asForm()
                ->withBasicAuth($clientId, $clientSecret)
                ->post($baseUrl.'/v1/oauth2/token', [
                    'grant_type' => 'client_credentials',
                ]);

            if ($response->successful()) {
                Notification::make()
                    ->title('PayPal connected ✓')
                    ->body('Mode: '.ucfirst($mode).' — access token issued successfully.')
                    ->success()
                    ->send();
            } else {
                Notification::make()
                    ->title('PayPal connection failed')
                    ->body($response->json('error_description') ?? 'Invalid credentials or network error.')
                    ->danger()
                    ->send();
            }
        } catch (\Throwable $e) {
            Notification::make()
                ->title('PayPal connection error')
                ->body($e->getMessage())
                ->danger()
                ->send();
        }
    }

    public function testAirwallexConnection(): void
    {
        $clientId = Setting::get('airwallex_client_id') ?: config('services.airwallex.client_id');
        $apiKey = Setting::get('airwallex_api_key') ?: config('services.airwallex.api_key');
        $mode = Setting::get('airwallex_mode') ?: config('services.airwallex.mode', 'sandbox');

        if (! $clientId || ! $apiKey) {
            Notification::make()
                ->title('Airwallex credentials not set')
                ->body('Please enter your Airwallex Client ID and API Key in the Airwallex tab.')
                ->warning()
                ->send();

            return;
        }

        try {
            $baseUrl = $mode === 'live' ? 'https://api.airwallex.com' : 'https://api-demo.airwallex.com';

            $response = Http::withHeaders([
                'x-client-id' => $clientId,
                'x-api-key' => $apiKey,
            ])->post($baseUrl.'/api/v1/authentication/login');

            if ($response->successful()) {
                Notification::make()
                    ->title('Airwallex connected ✓')
                    ->body('Mode: '.ucfirst($mode).' — access token issued successfully.')
                    ->success()
                    ->send();
            } else {
                Notification::make()
                    ->title('Airwallex connection failed')
                    ->body($response->json('message') ?? 'Invalid credentials or network error.')
                    ->danger()
                    ->send();
            }
        } catch (\Throwable $e) {
            Notification::make()
                ->title('Airwallex connection error')
                ->body($e->getMessage())
                ->danger()
                ->send();
        }
    }

    public function testPayoneerConnection(): void
    {
        $merchantCode = Setting::get('payoneer_merchant_code') ?: config('services.payoneer.merchant_code');
        $apiKey = Setting::get('payoneer_api_key') ?: config('services.payoneer.api_key');
        $apiSecret = Setting::get('payoneer_api_secret') ?: config('services.payoneer.api_secret');

        if (! $merchantCode || ! $apiKey || ! $apiSecret) {
            Notification::make()
                ->title('Payoneer credentials not set')
                ->body('Please enter your Payoneer Merchant Code, API Key, and API Secret in the Payoneer tab.')
                ->warning()
                ->send();

            return;
        }

        Notification::make()
            ->title('Payoneer credentials saved')
            ->body('Credentials are present. A full connectivity test isn\'t wired up yet — the first real checkout attempt through Payoneer will confirm they work.')
            ->success()
            ->send();
    }

    public function testPingPongConnection(): void
    {
        $appId = Setting::get('pingpong_app_id') ?: config('services.pingpong.app_id');
        $privateKey = Setting::get('pingpong_private_key') ?: config('services.pingpong.private_key');

        if (! $appId || ! $privateKey) {
            Notification::make()
                ->title('PingPong credentials not set')
                ->body('Please enter your PingPong App ID and Private Key in the PingPong tab.')
                ->warning()
                ->send();

            return;
        }

        if (! openssl_pkey_get_private($privateKey)) {
            Notification::make()
                ->title('PingPong private key invalid')
                ->body('The private key could not be parsed as a valid RSA key.')
                ->danger()
                ->send();

            return;
        }

        Notification::make()
            ->title('PingPong credentials valid')
            ->body('App ID is set and the private key parses correctly. A full connectivity test isn\'t wired up yet — the first real checkout attempt through PingPong will confirm the rest.')
            ->success()
            ->send();
    }

    public function form(Form $form): Form
    {
        return $form
            ->schema([
                Tabs::make('Payment')
                    ->tabs([
                        Tabs\Tab::make(__('Stripe'))
                            ->icon('heroicon-o-credit-card')
                            ->schema([
                                Section::make()
                                    ->headerActions([
                                        FormAction::make('testStripe')
                                            ->label('Test Stripe')
                                            ->icon('heroicon-o-bolt')
                                            ->color('gray')
                                            ->action(fn () => $this->testStripeConnection()),
                                    ])
                                    ->key('stripe_test_section')
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
                            ]),

                        Tabs\Tab::make(__('PayPal'))
                            ->icon('heroicon-o-credit-card')
                            ->schema([
                                Section::make()
                                    ->headerActions([
                                        FormAction::make('testPayPal')
                                            ->label('Test PayPal')
                                            ->icon('heroicon-o-bolt')
                                            ->color('gray')
                                            ->action(fn () => $this->testPayPalConnection()),
                                    ])
                                    ->key('paypal_test_section')
                                    ->schema([
                                Select::make('paypal_mode')
                                    ->label(__('PayPal Mode'))
                                    ->options([
                                        'sandbox' => 'Sandbox (Test)',
                                        'live' => 'Live (Production)',
                                    ])
                                    ->required()
                                    ->helperText('Switch to Sandbox to use PayPal test accounts without real charges.')
                                    ->columnSpanFull(),

                                Grid::make(2)->schema([
                                    TextInput::make('paypal_client_id')
                                        ->label(__('Client ID'))
                                        ->helperText('From developer.paypal.com → Apps & Credentials.'),

                                    TextInput::make('paypal_client_secret')
                                        ->label(__('Client Secret'))
                                        ->password()
                                        ->revealable()
                                        ->helperText('From developer.paypal.com → Apps & Credentials.'),
                                ]),

                                TextInput::make('paypal_webhook_id')
                                    ->label(__('Webhook ID'))
                                    ->password()
                                    ->revealable()
                                    ->helperText('From PayPal Dashboard → Webhooks → your endpoint → Webhook ID. Leave blank to skip signature verification (not recommended in live mode).')
                                    ->columnSpanFull(),

                                TextInput::make('paypal_webhook_url')
                                    ->label('PayPal Webhook Endpoint URL')
                                    ->default(fn () => url('/api/webhooks/paypal'))
                                    ->disabled()
                                    ->dehydrated(false)
                                    ->suffixAction(
                                        \Filament\Forms\Components\Actions\Action::make('copyPayPalWebhook')
                                            ->icon('heroicon-o-clipboard-document')
                                            ->tooltip('Copy to clipboard')
                                            ->action(fn () => null)
                                            ->extraAttributes([
                                                'x-on:click' => 'navigator.clipboard.writeText($el.closest(\'.fi-input-wrp\').querySelector(\'input\').value); $tooltip(\'Copied!\', { timeout: 1500 })',
                                            ])
                                    )
                                    ->helperText('Register this URL in your PayPal Dashboard → Webhooks.'),
                                    ]),
                            ]),

                        Tabs\Tab::make(__('Airwallex'))
                            ->icon('heroicon-o-credit-card')
                            ->schema([
                                Section::make()
                                    ->headerActions([
                                        FormAction::make('testAirwallex')
                                            ->label('Test Airwallex')
                                            ->icon('heroicon-o-bolt')
                                            ->color('gray')
                                            ->action(fn () => $this->testAirwallexConnection()),
                                    ])
                                    ->key('airwallex_test_section')
                                    ->schema([
                                Select::make('airwallex_mode')
                                    ->label(__('Airwallex Mode'))
                                    ->options([
                                        'sandbox' => 'Sandbox (Test)',
                                        'live' => 'Live (Production)',
                                    ])
                                    ->required()
                                    ->helperText('Switch to Sandbox to use Airwallex demo credentials without real charges.')
                                    ->columnSpanFull(),

                                Grid::make(2)->schema([
                                    TextInput::make('airwallex_client_id')
                                        ->label(__('Client ID'))
                                        ->helperText('From Airwallex Dashboard → Account → API Keys.'),

                                    TextInput::make('airwallex_api_key')
                                        ->label(__('API Key'))
                                        ->password()
                                        ->revealable()
                                        ->helperText('From Airwallex Dashboard → Account → API Keys.'),
                                ]),

                                TextInput::make('airwallex_webhook_secret')
                                    ->label(__('Webhook Secret'))
                                    ->password()
                                    ->revealable()
                                    ->helperText('From Airwallex Dashboard → Developer → Webhooks → your endpoint. Leave blank to skip signature verification (not recommended in live mode).')
                                    ->columnSpanFull(),

                                TextInput::make('airwallex_webhook_url')
                                    ->label('Airwallex Webhook Endpoint URL')
                                    ->default(fn () => url('/api/webhooks/airwallex'))
                                    ->disabled()
                                    ->dehydrated(false)
                                    ->suffixAction(
                                        \Filament\Forms\Components\Actions\Action::make('copyAirwallexWebhook')
                                            ->icon('heroicon-o-clipboard-document')
                                            ->tooltip('Copy to clipboard')
                                            ->action(fn () => null)
                                            ->extraAttributes([
                                                'x-on:click' => 'navigator.clipboard.writeText($el.closest(\'.fi-input-wrp\').querySelector(\'input\').value); $tooltip(\'Copied!\', { timeout: 1500 })',
                                            ])
                                    )
                                    ->helperText('Register this URL in your Airwallex Dashboard → Developer → Webhooks.'),
                                    ]),
                            ]),

                        Tabs\Tab::make(__('Payoneer'))
                            ->icon('heroicon-o-credit-card')
                            ->schema([
                                Section::make()
                                    ->headerActions([
                                        FormAction::make('testPayoneer')
                                            ->label('Test Payoneer')
                                            ->icon('heroicon-o-bolt')
                                            ->color('gray')
                                            ->action(fn () => $this->testPayoneerConnection()),
                                    ])
                                    ->key('payoneer_test_section')
                                    ->schema([
                                Select::make('payoneer_mode')
                                    ->label(__('Payoneer Mode'))
                                    ->options([
                                        'sandbox' => 'Sandbox (Test)',
                                        'live' => 'Live (Production)',
                                    ])
                                    ->required()
                                    ->helperText('Switch to Sandbox to use Payoneer test credentials without real charges.')
                                    ->columnSpanFull(),

                                TextInput::make('payoneer_merchant_code')
                                    ->label(__('Merchant Code'))
                                    ->helperText('From your Payoneer Checkout merchant account.')
                                    ->columnSpanFull(),

                                Grid::make(2)->schema([
                                    TextInput::make('payoneer_api_key')
                                        ->label(__('API Key'))
                                        ->password()
                                        ->revealable(),

                                    TextInput::make('payoneer_api_secret')
                                        ->label(__('API Secret'))
                                        ->password()
                                        ->revealable(),
                                ]),

                                TextInput::make('payoneer_webhook_secret')
                                    ->label(__('Webhook Secret'))
                                    ->password()
                                    ->revealable()
                                    ->helperText('Leave blank to skip signature verification (not recommended in live mode).')
                                    ->columnSpanFull(),

                                TextInput::make('payoneer_webhook_url')
                                    ->label('Payoneer Webhook Endpoint URL')
                                    ->default(fn () => url('/api/webhooks/payoneer'))
                                    ->disabled()
                                    ->dehydrated(false)
                                    ->suffixAction(
                                        \Filament\Forms\Components\Actions\Action::make('copyPayoneerWebhook')
                                            ->icon('heroicon-o-clipboard-document')
                                            ->tooltip('Copy to clipboard')
                                            ->action(fn () => null)
                                            ->extraAttributes([
                                                'x-on:click' => 'navigator.clipboard.writeText($el.closest(\'.fi-input-wrp\').querySelector(\'input\').value); $tooltip(\'Copied!\', { timeout: 1500 })',
                                            ])
                                    )
                                    ->helperText('Register this URL as the notification callback in your Payoneer Checkout dashboard.'),
                                    ]),
                            ]),

                        Tabs\Tab::make(__('PingPong'))
                            ->icon('heroicon-o-credit-card')
                            ->schema([
                                Section::make()
                                    ->headerActions([
                                        FormAction::make('testPingPong')
                                            ->label('Test PingPong')
                                            ->icon('heroicon-o-bolt')
                                            ->color('gray')
                                            ->action(fn () => $this->testPingPongConnection()),
                                    ])
                                    ->key('pingpong_test_section')
                                    ->schema([
                                Select::make('pingpong_mode')
                                    ->label(__('PingPong Mode'))
                                    ->options([
                                        'sandbox' => 'Sandbox (Test)',
                                        'live' => 'Live (Production)',
                                    ])
                                    ->required()
                                    ->helperText('Switch to Sandbox to use PingPong test credentials without real charges.')
                                    ->columnSpanFull(),

                                TextInput::make('pingpong_app_id')
                                    ->label(__('App ID'))
                                    ->helperText('From your PingPong merchant dashboard.')
                                    ->columnSpanFull(),

                                Textarea::make('pingpong_private_key')
                                    ->label(__('Merchant Private Key (PEM)'))
                                    ->rows(4)
                                    ->helperText('Your RSA private key, used to sign requests to PingPong.')
                                    ->columnSpanFull(),

                                Textarea::make('pingpong_public_key')
                                    ->label(__("PingPong's Public Key (PEM)"))
                                    ->rows(4)
                                    ->helperText('Used to verify the authenticity of PingPong webhook notifications. Leave blank to skip signature verification (not recommended in live mode).')
                                    ->columnSpanFull(),

                                TextInput::make('pingpong_webhook_url')
                                    ->label('PingPong Notification URL')
                                    ->default(fn () => url('/api/webhooks/pingpong'))
                                    ->disabled()
                                    ->dehydrated(false)
                                    ->suffixAction(
                                        \Filament\Forms\Components\Actions\Action::make('copyPingPongWebhook')
                                            ->icon('heroicon-o-clipboard-document')
                                            ->tooltip('Copy to clipboard')
                                            ->action(fn () => null)
                                            ->extraAttributes([
                                                'x-on:click' => 'navigator.clipboard.writeText($el.closest(\'.fi-input-wrp\').querySelector(\'input\').value); $tooltip(\'Copied!\', { timeout: 1500 })',
                                            ])
                                    )
                                    ->helperText('Register this URL as the notificationUrl in your PingPong merchant dashboard.'),
                                    ]),
                            ]),
                    ])
                    ->columnSpanFull(),
            ])
            ->statePath('data')
            ->columns(1);
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
                    'type' => is_bool($value) ? 'bool' : (is_numeric($value) ? 'int' : 'string'),
                    'group' => 'payment',
                ]
            );
        }

        Cache::forget('stripe_key');
        Cache::forget('stripe_secret');
        Cache::forget('stripe_webhook_secret');
        Cache::forget('paypal_client_id');
        Cache::forget('paypal_client_secret');
        Cache::forget('paypal_mode');
        Cache::forget('paypal_webhook_id');
        Cache::forget('paypal_access_token_sandbox');
        Cache::forget('paypal_access_token_live');

        Cache::forget('airwallex_client_id');
        Cache::forget('airwallex_api_key');
        Cache::forget('airwallex_webhook_secret');
        Cache::forget('airwallex_mode');
        Cache::forget('airwallex_access_token_sandbox');
        Cache::forget('airwallex_access_token_live');

        Cache::forget('payoneer_merchant_code');
        Cache::forget('payoneer_api_key');
        Cache::forget('payoneer_api_secret');
        Cache::forget('payoneer_webhook_secret');
        Cache::forget('payoneer_mode');

        Cache::forget('pingpong_app_id');
        Cache::forget('pingpong_private_key');
        Cache::forget('pingpong_public_key');
        Cache::forget('pingpong_mode');

        Notification::make()
            ->title('Payment settings saved successfully!')
            ->success()
            ->send();
    }
}
