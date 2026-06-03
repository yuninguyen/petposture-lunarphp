<?php

namespace App\Filament\Pages;

use App\Models\Setting;
use Filament\Forms\Components\Grid;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\Tabs;
use Filament\Forms\Components\TextInput;
use Filament\Forms\Components\FileUpload;
use Filament\Forms\Components\Textarea;
use Filament\Forms\Form;
use Filament\Pages\Page;
use Filament\Notifications\Notification;
use Filament\Actions\Action;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Mail;

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

        $data['stripe_key']            ??= config('services.stripe.key');
        $data['stripe_secret']         ??= config('services.stripe.secret');
        $data['stripe_webhook_secret'] ??= config('services.stripe.webhook_secret');
        $data['stripe_mode']           ??= 'live';

        $this->form->fill($data);
    }

    protected function getHeaderActions(): array
    {
        return [
            Action::make('testEmail')
                ->label('Send Test Email')
                ->icon('heroicon-o-paper-airplane')
                ->color('gray')
                ->requiresConfirmation()
                ->modalHeading('Send Test Email')
                ->modalDescription('This will send a test email to ' . auth()->user()->email . ' using the current SMTP settings.')
                ->action(function () {
                    $this->sendTestEmail();
                }),

            Action::make('testStripe')
                ->label('Test Stripe')
                ->icon('heroicon-o-credit-card')
                ->color('gray')
                ->action(function () {
                    $this->testStripeConnection();
                }),
        ];
    }

    public function sendTestEmail(): void
    {
        try {
            $smtpHost = Setting::get('smtp_host');

            if (! $smtpHost) {
                Notification::make()
                    ->title('SMTP not configured')
                    ->body('Please save your SMTP settings first.')
                    ->warning()
                    ->send();
                return;
            }

            // Build a mailer from the saved DB settings so we test what was actually saved,
            // not whatever is in the booted .env config.
            $mailerConfig = [
                'transport'  => 'smtp',
                'host'       => $smtpHost,
                'port'       => (int) (Setting::get('smtp_port') ?: 587),
                'encryption' => Setting::get('smtp_encryption') ?: 'tls',
                'username'   => Setting::get('smtp_user') ?: '',
                'password'   => Setting::get('smtp_pass') ?: '',
            ];

            $fromAddress = Setting::get('mail_from_address') ?: config('mail.from.address');
            $toAddress   = auth()->user()->email;

            // ssl = implicit TLS (port 465), tls = STARTTLS negotiation (null), none = plaintext
            $tlsMode = match ($mailerConfig['encryption']) {
                'ssl'  => true,
                'tls'  => null,
                default => false,
            };

            $transport = new \Symfony\Component\Mailer\Transport\Smtp\EsmtpTransport(
                $mailerConfig['host'],
                (int) $mailerConfig['port'],
                $tlsMode
            );
            if ($mailerConfig['username']) {
                $transport->setUsername($mailerConfig['username']);
                $transport->setPassword($mailerConfig['password']);
            }

            $mailer  = new \Symfony\Component\Mailer\Mailer($transport);
            $email   = (new \Symfony\Component\Mime\Email())
                ->from($fromAddress)
                ->to($toAddress)
                ->subject('[PetPosture] Test Email — SMTP Working ✓')
                ->text('This is a test email from PetPosture Admin. Your SMTP settings are working correctly! Sent at: ' . now()->toDateTimeString());

            $mailer->send($email);

            Notification::make()
                ->title('Test email sent!')
                ->body('Check ' . $toAddress . ' for the test message.')
                ->success()
                ->send();

        } catch (\Throwable $e) {
            Notification::make()
                ->title('SMTP failed')
                ->body($e->getMessage())
                ->danger()
                ->persistent()
                ->send();
        }
    }

    public function testStripeConnection(): void
    {
        $secret = Setting::get('stripe_secret') ?: config('services.stripe.secret');

        if (! $secret) {
            Notification::make()
                ->title('Stripe secret key not set')
                ->body('Please enter your Stripe Secret Key in the Payment tab.')
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
                    ->body('Account: ' . ($account['email'] ?? $account['id'] ?? 'verified') . ' — Mode: ' . (str_starts_with($secret, 'sk_test_') ? 'Test' : 'Live'))
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
                                FileUpload::make('shop_favicon')
                                    ->label(__('Favicon'))
                                    ->image()
                                    ->directory('settings')
                                    ->acceptedFileTypes(['image/x-icon', 'image/png', 'image/svg+xml'])
                                    ->helperText('Recommended: 32×32 or 64×64 px (.ico, .png, .svg)'),
                                Textarea::make('shop_description')
                                    ->label(__('Shop Description'))
                                    ->rows(3),
                            ]),

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
