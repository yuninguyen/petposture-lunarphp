<?php

namespace App\Services\Admin;

use App\Models\Setting;
use Illuminate\Support\Collection;
use InvalidArgumentException;

class PaymentMethodService
{
    private const GATEWAYS = [
        'stripe' => [
            'label' => 'Stripe',
            'mode' => ['key' => 'stripe_mode', 'config' => null, 'default' => 'live', 'values' => ['test', 'live']],
            'required' => ['stripe_secret'],
            'fields' => [
                'stripe_key' => ['secret' => false, 'config' => 'services.stripe.key', 'test' => false],
                'stripe_secret' => ['secret' => true, 'config' => 'services.stripe.secret', 'test' => true],
                'stripe_webhook_secret' => ['secret' => true, 'config' => 'services.stripe.webhook_secret', 'test' => false],
            ],
            'cache_keys' => ['stripe_key', 'stripe_secret', 'stripe_webhook_secret'],
        ],
        'paypal' => [
            'label' => 'PayPal',
            'mode' => ['key' => 'paypal_mode', 'config' => 'services.paypal.mode', 'default' => 'sandbox', 'values' => ['sandbox', 'live']],
            'required' => ['paypal_client_id', 'paypal_client_secret'],
            'fields' => [
                'paypal_client_id' => ['secret' => false, 'config' => 'services.paypal.client_id', 'test' => true],
                'paypal_client_secret' => ['secret' => true, 'config' => 'services.paypal.client_secret', 'test' => true],
                'paypal_webhook_id' => ['secret' => true, 'config' => 'services.paypal.webhook_id', 'test' => false],
            ],
            'cache_keys' => ['paypal_client_id', 'paypal_client_secret', 'paypal_mode', 'paypal_webhook_id', 'paypal_access_token_sandbox', 'paypal_access_token_live'],
        ],
        'airwallex' => [
            'label' => 'Airwallex',
            'mode' => ['key' => 'airwallex_mode', 'config' => 'services.airwallex.mode', 'default' => 'sandbox', 'values' => ['sandbox', 'live']],
            'required' => ['airwallex_client_id', 'airwallex_api_key'],
            'fields' => [
                'airwallex_client_id' => ['secret' => false, 'config' => 'services.airwallex.client_id', 'test' => true],
                'airwallex_api_key' => ['secret' => true, 'config' => 'services.airwallex.api_key', 'test' => true],
                'airwallex_webhook_secret' => ['secret' => true, 'config' => 'services.airwallex.webhook_secret', 'test' => false],
            ],
            'cache_keys' => ['airwallex_client_id', 'airwallex_api_key', 'airwallex_webhook_secret', 'airwallex_mode', 'airwallex_access_token_sandbox', 'airwallex_access_token_live'],
        ],
        'payoneer' => [
            'label' => 'Payoneer',
            'mode' => ['key' => 'payoneer_mode', 'config' => 'services.payoneer.mode', 'default' => 'sandbox', 'values' => ['sandbox', 'live']],
            'required' => ['payoneer_merchant_code', 'payoneer_api_key', 'payoneer_api_secret'],
            'fields' => [
                'payoneer_merchant_code' => ['secret' => false, 'config' => 'services.payoneer.merchant_code', 'test' => true],
                'payoneer_api_key' => ['secret' => true, 'config' => 'services.payoneer.api_key', 'test' => true],
                'payoneer_api_secret' => ['secret' => true, 'config' => 'services.payoneer.api_secret', 'test' => true],
                'payoneer_webhook_secret' => ['secret' => true, 'config' => 'services.payoneer.webhook_secret', 'test' => false],
            ],
            'cache_keys' => ['payoneer_merchant_code', 'payoneer_api_key', 'payoneer_api_secret', 'payoneer_webhook_secret', 'payoneer_mode'],
        ],
    ];

    public function all(): array
    {
        return array_map(fn (string $gateway): array => $this->describe($gateway), array_keys(self::GATEWAYS));
    }

    public function describe(string $gateway): array
    {
        $definition = $this->definition($gateway);
        $database = $this->databaseValues([
            ...array_keys($definition['fields']),
            $definition['mode']['key'],
        ]);
        $fields = [];

        foreach ($definition['fields'] as $key => $field) {
            $fields[$key] = $this->effectiveField($key, $field, $database);
        }

        return [
            'gateway' => $gateway,
            'label' => $definition['label'],
            'configured' => collect($definition['required'])
                ->every(fn (string $key): bool => $fields[$key]['configured']),
            'source' => $this->aggregateSource($fields),
            'mode' => $this->effectiveMode($definition, $database),
            'webhook_url' => url("/api/webhooks/{$gateway}"),
            'fields' => $fields,
        ];
    }

    public function hasGateway(string $gateway): bool
    {
        return array_key_exists($gateway, self::GATEWAYS);
    }

    private function definition(string $gateway): array
    {
        if (! $this->hasGateway($gateway)) {
            throw new InvalidArgumentException("Unsupported payment gateway [{$gateway}].");
        }

        return self::GATEWAYS[$gateway];
    }

    private function databaseValues(array $keys): Collection
    {
        return Setting::query()
            ->whereIn('key', $keys)
            ->get()
            ->mapWithKeys(fn (Setting $setting): array => [$setting->key => $setting->cast_value]);
    }

    private function effectiveField(string $key, array $field, Collection $database): array
    {
        $databaseValue = $database->get($key);
        $environmentValue = config($field['config']);

        if ($this->hasValue($databaseValue)) {
            $value = $databaseValue;
            $source = 'database';
        } elseif ($this->hasValue($environmentValue)) {
            $value = $environmentValue;
            $source = 'environment';
        } else {
            $value = null;
            $source = 'none';
        }

        $metadata = [
            'configured' => $source !== 'none',
            'source' => $source,
        ];

        if ($field['secret']) {
            $metadata['hint'] = $this->safeHint($source);
        } elseif ($source !== 'none') {
            $metadata['value'] = $value;
        }

        return $metadata;
    }

    private function effectiveMode(array $definition, Collection $database): string
    {
        $mode = $definition['mode'];
        $databaseValue = $database->get($mode['key']);

        if ($this->hasValue($databaseValue) && in_array($databaseValue, $mode['values'], true)) {
            return $databaseValue;
        }

        $environmentValue = $mode['config'] ? config($mode['config']) : null;

        if ($this->hasValue($environmentValue) && in_array($environmentValue, $mode['values'], true)) {
            return $environmentValue;
        }

        return $mode['default'];
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
