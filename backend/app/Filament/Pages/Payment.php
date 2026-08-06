<?php

namespace App\Filament\Pages;

use App\Models\Setting;
use Filament\Actions\Action;
use Filament\Forms\Components\Grid;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\Tabs;
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
        return __('Payment');
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

        $this->form->fill($data);
    }

    protected function getHeaderActions(): array
    {
        return [
            Action::make('testStripe')
                ->label('Test Stripe')
                ->icon('heroicon-o-credit-card')
                ->color('gray')
                ->action(fn () => $this->testStripeConnection()),

            Action::make('testPayPal')
                ->label('Test PayPal')
                ->icon('heroicon-o-credit-card')
                ->color('gray')
                ->action(fn () => $this->testPayPalConnection()),
        ];
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

    public function form(Form $form): Form
    {
        return $form
            ->schema([
                Tabs::make('Payment')
                    ->tabs([
                        Tabs\Tab::make(__('Stripe'))
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

                        Tabs\Tab::make(__('PayPal'))
                            ->icon('heroicon-o-credit-card')
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

        Notification::make()
            ->title('Payment settings saved successfully!')
            ->success()
            ->send();
    }
}
