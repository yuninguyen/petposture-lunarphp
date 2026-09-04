<?php

namespace App\Filament\Pages;

use App\Models\Setting;
use App\Services\AiSeoGeneratorService;
use App\Support\ImageUploadResizer;
use Filament\Actions\Action;
use Filament\Forms\Components\Actions\Action as FormAction;
use Filament\Forms\Components\FileUpload;
use Filament\Forms\Components\Grid;
use Filament\Forms\Components\Placeholder;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\Tabs;
use Filament\Forms\Components\Textarea;
use Filament\Forms\Components\TextInput;
use Filament\Forms\Form;
use Filament\Notifications\Notification;
use Filament\Pages\Page;
use Illuminate\Support\Facades\Http;
use Symfony\Component\Mailer\Mailer;
use Symfony\Component\Mailer\Transport\Smtp\EsmtpTransport;
use Symfony\Component\Mime\Email;

class ManageSettings extends Page
{
    private const AI_SECRET_KEYS = [
        'anthropic_api_key',
        'openai_api_key',
        'xai_api_key',
        'gemini_api_key',
    ];

    private const AI_MODEL_KEYS = [
        'anthropic_model',
        'openai_model',
        'openai_base_url',
        'xai_model',
        'gemini_model',
    ];

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

    public array $openaiAvailableModels = [];

    public function mount(): void
    {
        $data = [];
        foreach (Setting::all() as $setting) {
            if (in_array($setting->key, self::AI_SECRET_KEYS, true)) {
                continue;
            }

            $data[$setting->key] = $setting->value;
        }

        if (filled($data['openai_model'] ?? null)) {
            $this->openaiAvailableModels = [$data['openai_model'] => $data['openai_model']];
        }

        $this->form->fill($data);
    }

    public function fetchOpenAiModels(\Filament\Forms\Get $get): void
    {
        $apiKey = trim((string) $get('openai_api_key')) ?: (Setting::get('openai_api_key') ?: config('services.openai.key'));
        $baseUrl = trim((string) $get('openai_base_url')) ?: (Setting::get('openai_base_url') ?: config('services.openai.base_url')) ?: 'https://api.openai.com/v1';

        if (! $apiKey) {
            Notification::make()
                ->title('OpenAI API key not set')
                ->body('Enter your OpenAI API Key (and Base URL, if using a proxy) above first.')
                ->warning()
                ->send();

            return;
        }

        try {
            $response = Http::withToken($apiKey)
                ->timeout(15)
                ->get(rtrim($baseUrl, '/').'/models');

            if (! $response->successful()) {
                $error = $response->json('error');
                $message = is_string($error) ? $error : ($error['message'] ?? null);

                throw new \RuntimeException(
                    'HTTP '.$response->status().': '.($message ?: \Illuminate\Support\Str::limit($response->body(), 200))
                );
            }

            $ids = collect($response->json('data', []))
                ->pluck('id')
                ->filter()
                ->unique()
                ->sort()
                ->values()
                ->all();

            if ($ids === []) {
                Notification::make()
                    ->title('No models returned')
                    ->warning()
                    ->send();

                return;
            }

            $this->openaiAvailableModels = array_combine($ids, $ids);

            Notification::make()
                ->title(count($ids).' models loaded')
                ->body('Pick one from the OpenAI Model dropdown.')
                ->success()
                ->send();
        } catch (\Throwable $e) {
            Notification::make()
                ->title('Failed to fetch models')
                ->body($e->getMessage())
                ->danger()
                ->send();
        }
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
                ->modalDescription('This will send a test email to '.auth()->user()->email.' using the current SMTP settings.')
                ->action(function () {
                    $this->sendTestEmail();
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
                'transport' => 'smtp',
                'host' => $smtpHost,
                'port' => (int) (Setting::get('smtp_port') ?: 587),
                'encryption' => Setting::get('smtp_encryption') ?: 'tls',
                'username' => Setting::get('smtp_user') ?: '',
                'password' => Setting::get('smtp_pass') ?: '',
            ];

            $fromAddress = Setting::get('mail_from_address') ?: config('mail.from.address');
            $toAddress = auth()->user()->email;

            // ssl = implicit TLS (port 465), tls = STARTTLS negotiation (null), none = plaintext
            $tlsMode = match ($mailerConfig['encryption']) {
                'ssl' => true,
                'tls' => null,
                default => false,
            };

            $transport = new EsmtpTransport(
                $mailerConfig['host'],
                (int) $mailerConfig['port'],
                $tlsMode
            );
            if ($mailerConfig['username']) {
                $transport->setUsername($mailerConfig['username']);
                $transport->setPassword($mailerConfig['password']);
            }

            $mailer = new Mailer($transport);
            $email = (new Email)
                ->from($fromAddress)
                ->to($toAddress)
                ->subject('[PetPosture] Test Email — SMTP Working ✓')
                ->text('This is a test email from PetPosture Admin. Your SMTP settings are working correctly! Sent at: '.now()->toDateTimeString());

            $mailer->send($email);

            Notification::make()
                ->title('Test email sent!')
                ->body('Check '.$toAddress.' for the test message.')
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
                                    ->label(__('Storefront Logo'))
                                    ->image()
                                    ->directory('settings')
                                    ->saveUploadedFileUsing(ImageUploadResizer::make(800, 800)),
                                FileUpload::make('shop_favicon')
                                    ->label(__('Storefront Favicon'))
                                    ->image()
                                    ->directory('settings')
                                    ->acceptedFileTypes(['image/png'])
                                    ->maxSize(512)
                                    ->rules(['dimensions:ratio=1/1'])
                                    ->helperText('Upload a square PNG. It will be served as a normalized 96×96 storefront favicon.'),
                                Textarea::make('shop_description')
                                    ->label(__('Shop Description'))
                                    ->rows(3)
                                    ->helperText(__('Shown in the site footer and used as the default SEO description for pages that don\'t have their own (homepage, contact, etc.). Keep it to about 150–160 characters for best results in search results.')),
                            ]),

                        Tabs\Tab::make(__('Admin Branding'))
                            ->icon('heroicon-o-building-office-2')
                            ->schema([
                                FileUpload::make('admin_logo')
                                    ->label(__('Admin Logo'))
                                    ->image()
                                    ->directory('settings/admin')
                                    ->saveUploadedFileUsing(ImageUploadResizer::make(800, 800)),
                                FileUpload::make('admin_favicon')
                                    ->label(__('Admin Favicon'))
                                    ->image()
                                    ->directory('settings/admin')
                                    ->acceptedFileTypes(['image/png', 'image/x-icon'])
                                    ->maxSize(512),
                            ]),

                        Tabs\Tab::make(__('Analytics'))
                            ->icon('heroicon-o-chart-bar')
                            ->schema([
                                TextInput::make('google_analytics_id')
                                    ->label(__('Google Analytics Measurement ID'))
                                    ->placeholder('G-XXXXXXXXXX')
                                    ->helperText(__('Paste your GA4 Measurement ID here — the tracking script is added to the storefront automatically, no code changes needed.')),
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
                                            'tls' => 'TLS',
                                            'ssl' => 'SSL',
                                            'none' => 'None',
                                        ]),
                                    TextInput::make('mail_from_address')
                                        ->label(__('Mail From Address'))
                                        ->email(),
                                ]),
                            ]),

                        Tabs\Tab::make(__('AI Settings'))
                            ->icon('heroicon-o-sparkles')
                            ->schema([
                                Select::make('ai_seo_provider')
                                    ->label(__('Preferred AI SEO Provider'))
                                    ->options([
                                        'auto' => 'Automatic (Anthropic → OpenAI → Grok → Gemini)',
                                        'anthropic' => 'Anthropic Claude',
                                        'openai' => 'OpenAI',
                                        'grok' => 'xAI Grok',
                                        'gemini' => 'Google Gemini',
                                    ])
                                    ->default('auto')
                                    ->helperText(__('Saved Settings override environment values. The selected provider is tried first; other configured providers are fallback candidates.')),
                                Placeholder::make('ai_seo_provider_status')
                                    ->label(__('Configured AI SEO Providers'))
                                    ->content(fn (): string => $this->aiSeoProviderStatus()),
                                Grid::make(2)->schema([
                                    TextInput::make('anthropic_api_key')
                                        ->label(__('Anthropic API Key'))
                                        ->password()
                                        ->helperText(__('Leave blank to keep the stored value or use ANTHROPIC_API_KEY.')),
                                    TextInput::make('anthropic_model')
                                        ->label(__('Anthropic Model'))
                                        ->helperText(__('Optional: defaults to claude-sonnet-5 when no Setting or ANTHROPIC_MODEL is supplied.')),
                                    TextInput::make('openai_api_key')
                                        ->label(__('OpenAI API Key'))
                                        ->password()
                                        ->helperText(__('Leave blank to keep the stored value or use OPENAI_API_KEY.')),
                                    Select::make('openai_model')
                                        ->label(__('OpenAI Model'))
                                        ->options(fn (): array => $this->openaiAvailableModels)
                                        ->searchable()
                                        ->requiredWith('openai_api_key')
                                        ->helperText(__('Required with an OpenAI API key. Fill in the API Key (and Base URL, if using a proxy), then click refresh to list available models.'))
                                        ->suffixAction(
                                            FormAction::make('fetchOpenAiModels')
                                                ->icon('heroicon-o-arrow-path')
                                                ->tooltip(__('Fetch available models'))
                                                ->action(fn (\Filament\Forms\Get $get) => $this->fetchOpenAiModels($get)),
                                        ),
                                    TextInput::make('openai_base_url')
                                        ->label(__('OpenAI Base URL'))
                                        ->url()
                                        ->placeholder('https://api.openai.com/v1')
                                        ->helperText(__('Optional: point at an OpenAI-compatible proxy (e.g. cliproxyapi) instead of the official API.')),
                                    TextInput::make('xai_api_key')
                                        ->label(__('xAI API Key'))
                                        ->password()
                                        ->helperText(__('Leave blank to keep the stored value or use XAI_API_KEY.')),
                                    TextInput::make('xai_model')
                                        ->label(__('xAI Grok Model'))
                                        ->requiredWith('xai_api_key')
                                        ->helperText(__('Required with an xAI API key.')),
                                    TextInput::make('gemini_api_key')
                                        ->label(__('Gemini API Key'))
                                        ->password()
                                        ->helperText(__('Leave blank to keep the stored value or use GEMINI_API_KEY.')),
                                    TextInput::make('gemini_model')
                                        ->label(__('Gemini Model'))
                                        ->requiredWith('gemini_api_key')
                                        ->helperText(__('Required with a Gemini API key.')),
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
                if (in_array($key, self::AI_MODEL_KEYS, true)) {
                    Setting::where('key', $key)->first()?->delete();
                }

                continue;
            }

            Setting::updateOrCreate(
                ['key' => $key],
                [
                    'value' => $value,
                    'type' => $this->guessType($value),
                    'group' => $this->guessGroup($key),
                ]
            );
        }

        Notification::make()
            ->title('Settings saved successfully!')
            ->success()
            ->send();
    }

    protected function guessType(mixed $value): string
    {
        if (is_bool($value)) {
            return 'bool';
        }
        if (is_array($value)) {
            return 'json';
        }
        if (is_numeric($value)) {
            return 'int';
        }

        return 'string';
    }

    protected function guessGroup(string $key): string
    {
        if (str_starts_with($key, 'smtp_') || $key === 'mail_from_address') {
            return 'email';
        }
        if (str_starts_with($key, 'stripe_') || str_starts_with($key, 'paypal_')) {
            return 'payment';
        }
        if (str_starts_with($key, 'admin_')) {
            return 'admin';
        }
        if ($key === 'ai_seo_provider' || in_array($key, [
            ...self::AI_SECRET_KEYS,
            ...self::AI_MODEL_KEYS,
        ], true)) {
            return 'ai';
        }

        return 'general';
    }

    private function aiSeoProviderStatus(): string
    {
        $service = app(AiSeoGeneratorService::class);
        $providers = $service->configuredProviderNames();

        if ($providers === []) {
            return __('None configured');
        }

        return __('Active: :provider. Configured: :providers.', [
            'provider' => $service->activeProviderName(),
            'providers' => implode(', ', $providers),
        ]);
    }
}
