<?php

namespace App\Services\Admin;

use App\Models\Setting;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Validator;
use Symfony\Component\Mailer\Exception\TransportException;
use Symfony\Component\Mailer\Exception\UnexpectedResponseException;
use Symfony\Component\Mailer\Mailer;
use Symfony\Component\Mailer\Transport\Smtp\EsmtpTransport;
use Symfony\Component\Mime\Email;
use Throwable;

class SecureSettingsService
{
    private const SMTP_FIELDS = [
        'smtp_host' => ['secret' => false, 'config' => 'mail.environment.smtp.host', 'type' => 'string'],
        'smtp_port' => ['secret' => false, 'config' => 'mail.environment.smtp.port', 'type' => 'int'],
        'smtp_user' => ['secret' => false, 'config' => 'mail.environment.smtp.username', 'type' => 'string'],
        'smtp_pass' => ['secret' => true, 'config' => 'mail.environment.smtp.password', 'type' => 'string'],
        'smtp_encryption' => ['secret' => false, 'config' => 'mail.environment.smtp.scheme', 'type' => 'string'],
        'mail_from_address' => ['secret' => false, 'config' => 'mail.environment.from.address', 'type' => 'string'],
    ];

    private const AI_FIELDS = [
        'ai_seo_provider' => ['secret' => false, 'config' => null, 'default' => 'auto', 'type' => 'string'],
        'anthropic_api_key' => ['secret' => true, 'config' => 'services.anthropic.key', 'type' => 'string'],
        'anthropic_model' => ['secret' => false, 'config' => 'services.anthropic.model', 'default' => 'claude-sonnet-5', 'type' => 'string'],
        'openai_api_key' => ['secret' => true, 'config' => 'services.openai.key', 'type' => 'string'],
        'openai_model' => ['secret' => false, 'config' => 'services.openai.model', 'type' => 'string'],
        'openai_base_url' => ['secret' => false, 'config' => 'services.openai.base_url', 'type' => 'string'],
        'xai_api_key' => ['secret' => true, 'config' => 'services.xai.key', 'type' => 'string'],
        'xai_model' => ['secret' => false, 'config' => 'services.xai.model', 'type' => 'string'],
        'gemini_api_key' => ['secret' => true, 'config' => 'services.gemini.key', 'type' => 'string'],
        'gemini_model' => ['secret' => false, 'config' => 'services.gemini.model', 'type' => 'string'],
    ];

    private const AI_PROVIDER_VALUES = ['auto', 'anthropic', 'openai', 'grok', 'gemini'];

    public function smtp(): array
    {
        return $this->describe(self::SMTP_FIELDS, ['smtp_host', 'smtp_port', 'mail_from_address']);
    }

    public function updateSmtp(array $payload): array
    {
        $this->update($payload, self::SMTP_FIELDS, 'email');

        return $this->smtp();
    }

    public function testSmtp(array $payload, string $recipient): array
    {
        $configuration = [];
        foreach (self::SMTP_FIELDS as $field => $definition) {
            $configuration[$field] = $this->resolveCandidateField($field, $payload, $definition);
        }

        $configuration['smtp_port'] ??= 587;
        $configuration['smtp_encryption'] ??= 'tls';

        if (Validator::make($configuration, [
            'smtp_host' => ['required', 'string', 'max:255'],
            'smtp_port' => ['required', 'integer', 'between:1,65535'],
            'smtp_user' => ['nullable', 'string', 'max:255'],
            'smtp_pass' => ['nullable', 'string', 'max:4096'],
            'smtp_encryption' => ['required', 'string', 'in:tls,ssl,none'],
            'mail_from_address' => ['required', 'string', 'email:rfc', 'max:255'],
        ])->fails()) {
            return [
                'status_code' => 422,
                'data' => [
                    'status' => 'invalid',
                    'message' => 'The effective SMTP configuration is invalid.',
                ],
            ];
        }

        try {
            $this->sendSmtpTest($configuration, $recipient);
        } catch (UnexpectedResponseException $exception) {
            if (in_array($exception->getCode(), [450, 451, 452, 500, 501, 502, 503, 504, 530, 534, 535, 538, 550, 551, 552, 553, 554, 555], true)) {
                return $this->smtpRejectionResponse();
            }

            return $this->smtpUnavailableResponse();
        } catch (TransportException $exception) {
            if (in_array($exception->getCode(), [450, 451, 452, 500, 501, 502, 503, 504, 530, 534, 535, 538, 550, 551, 552, 553, 554, 555], true)) {
                return $this->smtpRejectionResponse();
            }

            return $this->smtpUnavailableResponse();
        } catch (Throwable) {
            return $this->smtpUnavailableResponse();
        }

        return [
            'status_code' => 200,
            'data' => [
                'status' => 'sent',
                'message' => 'SMTP test email sent.',
            ],
        ];
    }

    private function smtpRejectionResponse(): array
    {
        return [
            'status_code' => 422,
            'data' => [
                'status' => 'rejected',
                'message' => 'The SMTP server rejected the test email.',
            ],
        ];
    }

    private function smtpUnavailableResponse(): array
    {
        return [
            'status_code' => 502,
            'data' => [
                'status' => 'unavailable',
                'message' => 'Unable to send the SMTP test email.',
            ],
        ];
    }

    public function ai(): array
    {
        return $this->describe(self::AI_FIELDS);
    }

    public function updateAi(array $payload): array
    {
        $this->update($payload, self::AI_FIELDS, 'ai');

        return $this->ai();
    }

    public function fetchOpenAiModels(array $payload): array
    {
        $apiKey = $this->resolveCandidateField('openai_api_key', $payload, self::AI_FIELDS['openai_api_key']);
        if (! is_string($apiKey) || ! $this->hasValue($apiKey)) {
            return $this->openAiInvalidResponse();
        }

        $baseUrl = $this->resolveCandidateField('openai_base_url', $payload, self::AI_FIELDS['openai_base_url']);
        if (! is_string($baseUrl) || ! $this->hasValue($baseUrl)) {
            $baseUrl = 'https://api.openai.com/v1';
        }

        try {
            $response = Http::withToken($apiKey)
                ->timeout(15)
                ->get(rtrim($baseUrl, '/').'/models');
        } catch (Throwable) {
            return $this->openAiUnavailableResponse();
        }

        if (! $response->successful()) {
            return $this->openAiInvalidResponse();
        }

        $models = collect($response->json('data'))
            ->pluck('id')
            ->filter(fn (mixed $id): bool => is_string($id) && trim($id) !== '')
            ->map(fn (string $id): string => trim($id))
            ->unique()
            ->sort()
            ->values()
            ->all();

        if ($models === []) {
            return $this->openAiInvalidResponse();
        }

        $model = $this->resolveCandidateField('openai_model', $payload, self::AI_FIELDS['openai_model']);
        if (is_string($model) && $this->hasValue($model) && ! in_array(trim($model), $models, true)) {
            return $this->openAiInvalidResponse($models);
        }

        return [
            'status_code' => 200,
            'data' => [
                'status' => 'loaded',
                'models' => $models,
            ],
        ];
    }

    private function openAiInvalidResponse(array $models = []): array
    {
        return [
            'status_code' => 422,
            'data' => [
                'status' => 'invalid',
                'models' => $models,
            ],
        ];
    }

    private function openAiUnavailableResponse(): array
    {
        return [
            'status_code' => 502,
            'data' => [
                'status' => 'unavailable',
                'models' => [],
            ],
        ];
    }

    public function smtpFieldNames(): array
    {
        return array_keys(self::SMTP_FIELDS);
    }

    public function aiFieldNames(): array
    {
        return array_keys(self::AI_FIELDS);
    }

    public function aiProviderValues(): array
    {
        return self::AI_PROVIDER_VALUES;
    }

    private function describe(array $definitions, array $required = []): array
    {
        $database = $this->databaseValues(array_keys($definitions));
        $fields = [];

        foreach ($definitions as $key => $definition) {
            $fields[$key] = $this->effectiveField($key, $definition, $database);
        }

        return [
            'configured' => $required === []
                ? collect($fields)->contains(fn (array $field): bool => $field['configured'])
                : collect($required)->every(fn (string $key): bool => $fields[$key]['configured']),
            'source' => $this->aggregateSource($fields),
            'fields' => $fields,
        ];
    }

    private function update(array $payload, array $definitions, string $group): void
    {
        foreach (($payload['clear_fields'] ?? []) as $key) {
            if (array_key_exists($key, $definitions)) {
                Setting::query()->where('key', $key)->first()?->delete();
            }
        }

        foreach (($payload['fields'] ?? []) as $key => $value) {
            if (! array_key_exists($key, $definitions) || ! $this->hasValue($value)) {
                continue;
            }

            $definition = $definitions[$key];
            Setting::set($key, $value, $definition['type'], $group);
        }
    }

    private function resolveCandidateField(string $field, array $payload, array $definition): mixed
    {
        $candidate = $payload['fields'][$field] ?? null;
        if ($this->hasValue($candidate)) {
            return $candidate;
        }

        if (! in_array($field, $payload['clear_fields'] ?? [], true)) {
            $databaseValue = Setting::query()->where('key', $field)->first()?->cast_value;
            if ($this->hasValue($databaseValue)) {
                return $databaseValue;
            }
        }

        $environmentValue = $definition['config'] === null ? null : config($definition['config']);

        return $this->hasValue($environmentValue) ? $environmentValue : ($definition['default'] ?? null);
    }

    protected function sendSmtpTest(array $configuration, string $recipient): void
    {
        $tlsMode = match ($configuration['smtp_encryption']) {
            'ssl' => true,
            'tls' => null,
            default => false,
        };
        $transport = new EsmtpTransport(
            $configuration['smtp_host'],
            $configuration['smtp_port'],
            $tlsMode
        );

        if ($this->hasValue($configuration['smtp_user'])) {
            $transport->setUsername((string) $configuration['smtp_user']);
            $transport->setPassword((string) ($configuration['smtp_pass'] ?? ''));
        }

        $email = (new Email)
            ->from((string) $configuration['mail_from_address'])
            ->to($recipient)
            ->subject('[PetPosture] Test Email — SMTP Working ✓')
            ->text('This is a test email from PetPosture Admin. Your SMTP settings are working correctly.');

        (new Mailer($transport))->send($email);
    }

    private function databaseValues(array $keys): Collection
    {
        return Setting::query()
            ->whereIn('key', $keys)
            ->get()
            ->mapWithKeys(fn (Setting $setting): array => [$setting->key => $setting->cast_value]);
    }

    private function effectiveField(string $key, array $definition, Collection $database): array
    {
        $databaseValue = $database->get($key);
        $environmentValue = $definition['config'] === null ? null : config($definition['config']);

        if ($this->hasValue($databaseValue)) {
            $value = $databaseValue;
            $source = 'database';
        } elseif ($this->hasValue($environmentValue)) {
            $value = $environmentValue;
            $source = 'environment';
        } else {
            $value = $definition['default'] ?? null;
            $source = 'none';
        }

        $metadata = [
            'configured' => $source !== 'none',
            'source' => $source,
            'hint' => $this->safeHint($source),
        ];

        if (! $definition['secret']) {
            $metadata['value'] = $value;
        }

        return $metadata;
    }

    private function aggregateSource(array $fields): string
    {
        $sources = collect($fields)
            ->pluck('source')
            ->reject(fn (string $source): bool => $source === 'none')
            ->unique()
            ->values();

        if ($sources->isEmpty()) {
            return 'none';
        }

        return $sources->count() === 1 ? $sources->first() : 'mixed';
    }

    private function safeHint(string $source): string
    {
        return match ($source) {
            'database' => 'Configured in database',
            'environment' => 'Using environment configuration',
            default => 'Not configured',
        };
    }

    private function hasValue(mixed $value): bool
    {
        return (bool) $value;
    }
}
