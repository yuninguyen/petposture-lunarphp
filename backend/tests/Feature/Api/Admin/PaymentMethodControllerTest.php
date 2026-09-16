<?php

namespace Tests\Feature\Api\Admin;

use App\Models\Setting;
use App\Models\User;
use App\Services\AirwallexService;
use App\Services\PayoneerService;
use App\Services\PayPalService;
use App\Services\StripePaymentIntentService;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Log\Events\MessageLogged;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Http;
use Laravel\Sanctum\Sanctum;
use ReflectionMethod;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class PaymentMethodControllerTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(RoleSeeder::class);

        foreach (['super_admin', 'admin', 'staff', 'Product Manager', 'Order Manager', 'Support', 'customer'] as $role) {
            Role::firstOrCreate(['name' => $role, 'guard_name' => 'web']);
        }
    }

    public function test_payment_method_index_requires_authentication(): void
    {
        $this->getJson('/api/admin/finance/payment-methods')->assertUnauthorized();
    }

    public function test_only_core_admin_roles_can_access_payment_methods(): void
    {
        foreach (['customer', 'Product Manager', 'Order Manager', 'Support'] as $role) {
            Sanctum::actingAs($this->userWithRole($role));
            $this->getJson('/api/admin/finance/payment-methods')->assertForbidden();
        }

        foreach (['super_admin', 'admin', 'staff'] as $role) {
            Sanctum::actingAs($this->userWithRole($role));
            $this->getJson('/api/admin/finance/payment-methods')->assertOk();
        }
    }

    public function test_index_returns_four_gateways_with_safe_field_metadata(): void
    {
        config()->set('services.stripe.key', 'pk_test_environment_safe');
        config()->set('services.stripe.secret', 'sk_test_environment_must_not_leak');
        Setting::set('stripe_secret', 'sk_test_database_must_not_leak', 'string', 'payment');

        Sanctum::actingAs($this->userWithRole('admin'));
        $response = $this->getJson('/api/admin/finance/payment-methods')->assertOk();

        $this->assertSame(
            ['stripe', 'paypal', 'airwallex', 'payoneer'],
            collect($response->json('data'))->pluck('gateway')->all()
        );
        $response->assertJsonPath('data.0.source', 'mixed');
        $response->assertJsonPath('data.0.fields.stripe_key.value', 'pk_test_environment_safe');
        $response->assertJsonPath('data.0.fields.stripe_secret.source', 'database');
        $response->assertJsonPath('data.0.fields.stripe_secret.hint', 'Configured in database');
        $response->assertJsonMissingPath('data.0.fields.stripe_secret.value');

        $raw = $response->getContent();
        $this->assertStringNotContainsString('sk_test_database_must_not_leak', $raw);
        $this->assertStringNotContainsString('sk_test_environment_must_not_leak', $raw);
        $this->assertStringNotContainsString('********', $raw);
        $this->assertStringNotContainsString('pingpong', strtolower($raw));
    }

    public function test_index_reports_database_environment_mixed_and_none_sources(): void
    {
        config()->set('services.stripe.key', null);
        config()->set('services.stripe.secret', null);
        config()->set('services.stripe.webhook_secret', null);
        config()->set('services.paypal.client_id', 'paypal_environment_client');
        config()->set('services.paypal.client_secret', 'paypal_environment_secret');
        config()->set('services.paypal.webhook_id', null);
        config()->set('services.airwallex.client_id', 'airwallex_environment_client');
        config()->set('services.airwallex.api_key', null);
        config()->set('services.airwallex.webhook_secret', null);
        config()->set('services.payoneer.merchant_code', null);
        config()->set('services.payoneer.api_key', null);
        config()->set('services.payoneer.api_secret', null);
        config()->set('services.payoneer.webhook_secret', null);

        Setting::set('stripe_secret', 'stripe_database_secret', 'string', 'payment');
        Setting::set('airwallex_api_key', 'airwallex_database_key', 'string', 'payment');
        Setting::set('payoneer_api_key', '', 'string', 'payment');

        Sanctum::actingAs($this->userWithRole('admin'));
        $response = $this->getJson('/api/admin/finance/payment-methods')->assertOk();
        $gateways = collect($response->json('data'))->keyBy('gateway');

        $this->assertSame('database', $gateways['stripe']['source']);
        $this->assertSame('environment', $gateways['paypal']['source']);
        $this->assertSame('mixed', $gateways['airwallex']['source']);
        $this->assertSame('none', $gateways['payoneer']['source']);

        $this->assertTrue($gateways['stripe']['configured']);
        $this->assertTrue($gateways['paypal']['configured']);
        $this->assertTrue($gateways['airwallex']['configured']);
        $this->assertFalse($gateways['payoneer']['configured']);
    }

    public function test_database_zero_values_fall_back_like_live_checkout(): void
    {
        config()->set('services.payoneer.merchant_code', 'environment_merchant');
        config()->set('services.payoneer.api_key', 'environment_api_key');
        config()->set('services.payoneer.api_secret', 'environment_api_secret');

        Setting::set('payoneer_merchant_code', '0', 'string', 'payment');
        Setting::set('payoneer_api_key', 0, 'int', 'payment');
        Setting::set('payoneer_api_secret', false, 'bool', 'payment');

        Sanctum::actingAs($this->userWithRole('admin'));
        $response = $this->getJson('/api/admin/finance/payment-methods')->assertOk();
        $payoneer = collect($response->json('data'))->firstWhere('gateway', 'payoneer');

        $this->assertSame('environment', $payoneer['source']);
        $this->assertSame('environment_merchant', $payoneer['fields']['payoneer_merchant_code']['value']);
        $this->assertSame('environment', $payoneer['fields']['payoneer_api_key']['source']);
        $this->assertSame('environment', $payoneer['fields']['payoneer_api_secret']['source']);
    }

    public function test_database_whitespace_remains_effective_like_live_checkout(): void
    {
        config()->set('services.payoneer.merchant_code', 'environment_merchant');
        Setting::set('payoneer_merchant_code', '   ', 'string', 'payment');

        Sanctum::actingAs($this->userWithRole('admin'));
        $response = $this->getJson('/api/admin/finance/payment-methods')->assertOk();
        $payoneer = collect($response->json('data'))->firstWhere('gateway', 'payoneer');

        $this->assertSame('database', $payoneer['fields']['payoneer_merchant_code']['source']);
        $this->assertSame('   ', $payoneer['fields']['payoneer_merchant_code']['value']);
    }

    public function test_index_returns_modes_and_webhook_urls_without_aggregating_mode_source(): void
    {
        config()->set('services.stripe.secret', 'stripe_environment_secret');
        config()->set('services.paypal.client_id', null);
        config()->set('services.paypal.client_secret', null);
        config()->set('services.airwallex.client_id', null);
        config()->set('services.airwallex.api_key', null);
        config()->set('services.payoneer.merchant_code', null);
        config()->set('services.payoneer.api_key', null);
        config()->set('services.payoneer.api_secret', null);

        Setting::set('stripe_mode', 'test', 'string', 'payment');
        Setting::set('paypal_mode', 'invalid-mode', 'string', 'payment');

        Sanctum::actingAs($this->userWithRole('admin'));
        $response = $this->getJson('/api/admin/finance/payment-methods')->assertOk();
        $gateways = collect($response->json('data'))->keyBy('gateway');

        $this->assertSame('test', $gateways['stripe']['mode']);
        $this->assertSame('environment', $gateways['stripe']['source']);
        $this->assertSame('sandbox', $gateways['paypal']['mode']);

        foreach (['stripe', 'paypal', 'airwallex', 'payoneer'] as $gateway) {
            $this->assertStringEndsWith("/api/webhooks/{$gateway}", $gateways[$gateway]['webhook_url']);
            $this->assertArrayNotHasKey($gateway.'_mode', $gateways[$gateway]['fields']);
        }
    }

    public function test_payment_method_update_requires_authentication_and_core_admin_role(): void
    {
        $this->putJson('/api/admin/finance/payment-methods/stripe', [])->assertUnauthorized();

        foreach (['customer', 'Product Manager', 'Order Manager', 'Support'] as $role) {
            Sanctum::actingAs($this->userWithRole($role));
            $this->putJson('/api/admin/finance/payment-methods/stripe', [])->assertForbidden();
        }

        foreach (['super_admin', 'admin', 'staff'] as $role) {
            Sanctum::actingAs($this->userWithRole($role));
            $this->putJson('/api/admin/finance/payment-methods/stripe', [])->assertOk();
        }
    }

    public function test_unknown_payment_gateway_update_returns_not_found(): void
    {
        Sanctum::actingAs($this->userWithRole('admin'));
        $this->putJson('/api/admin/finance/payment-methods/pingpong', [])->assertNotFound();
    }

    public function test_update_omission_and_empty_secret_preserve_existing_values(): void
    {
        Setting::set('stripe_key', 'pk_existing', 'string', 'payment');
        Setting::set('stripe_secret', 'sk_existing_must_not_leak', 'string', 'payment');

        Sanctum::actingAs($this->userWithRole('admin'));
        $response = $this->putJson('/api/admin/finance/payment-methods/stripe', [
            'fields' => ['stripe_secret' => ''],
        ])->assertOk();
        $this->putJson('/api/admin/finance/payment-methods/stripe', [
            'fields' => ['stripe_secret' => '   '],
        ])->assertOk();

        $this->assertSame('pk_existing', Setting::where('key', 'stripe_key')->value('value'));
        $this->assertSame('sk_existing_must_not_leak', Setting::where('key', 'stripe_secret')->value('value'));
        $this->assertStringNotContainsString('sk_existing_must_not_leak', $response->getContent());
    }

    public function test_update_replaces_only_allowlisted_fields_and_returns_no_secret(): void
    {
        Sanctum::actingAs($this->userWithRole('admin'));
        $response = $this->putJson('/api/admin/finance/payment-methods/stripe', [
            'mode' => 'test',
            'fields' => [
                'stripe_key' => 'pk_replacement',
                'stripe_secret' => 'sk_replacement_must_not_leak',
            ],
        ])->assertOk()
            ->assertJsonPath('data.mode', 'test')
            ->assertJsonPath('data.fields.stripe_key.value', 'pk_replacement')
            ->assertJsonMissingPath('data.fields.stripe_secret.value');

        $this->assertSame('pk_replacement', Setting::where('key', 'stripe_key')->value('value'));
        $this->assertSame('sk_replacement_must_not_leak', Setting::where('key', 'stripe_secret')->value('value'));
        $this->assertStringNotContainsString('sk_replacement_must_not_leak', $response->getContent());
    }

    public function test_clear_fields_deletes_database_override_and_restores_environment_fallback(): void
    {
        config()->set('services.stripe.secret', 'sk_environment_must_not_leak');
        Setting::set('stripe_secret', 'sk_database_must_not_leak', 'string', 'payment');
        $this->assertSame('sk_database_must_not_leak', Setting::get('stripe_secret'));

        Sanctum::actingAs($this->userWithRole('admin'));
        $response = $this->putJson('/api/admin/finance/payment-methods/stripe', [
            'clear_fields' => ['stripe_secret'],
        ])->assertOk()
            ->assertJsonPath('data.fields.stripe_secret.source', 'environment');

        $this->assertDatabaseMissing('settings', ['key' => 'stripe_secret']);
        $this->assertNull(Setting::get('stripe_secret'));
        $this->assertStringNotContainsString('sk_database_must_not_leak', $response->getContent());
        $this->assertStringNotContainsString('sk_environment_must_not_leak', $response->getContent());
    }

    public function test_update_rejects_arbitrary_fields_and_replace_clear_conflicts(): void
    {
        Sanctum::actingAs($this->userWithRole('admin'));

        foreach ([
            ['fields' => ['paypal_client_id' => 'not-allowed']],
            ['fields' => ['arbitrary_setting' => 'not-allowed']],
            ['clear_fields' => ['paypal_client_secret']],
            ['clear_fields' => ['stripe_secret', 'stripe_secret']],
            ['clear_fields' => 'stripe_secret'],
            ['fields' => ['stripe_secret' => ['invalid']]],
            ['mode' => 'sandbox'],
            ['mode' => null],
        ] as $payload) {
            $this->putJson('/api/admin/finance/payment-methods/stripe', $payload)->assertUnprocessable();
        }

        foreach (['paypal', 'airwallex', 'payoneer'] as $gateway) {
            $this->putJson("/api/admin/finance/payment-methods/{$gateway}", ['mode' => 'test'])
                ->assertUnprocessable();
        }

        $this->assertDatabaseMissing('settings', ['key' => 'arbitrary_setting']);
        $this->assertDatabaseMissing('settings', ['key' => 'paypal_client_id']);

        $this->putJson('/api/admin/finance/payment-methods/stripe', [
            'fields' => ['stripe_secret' => 'replacement'],
            'clear_fields' => ['stripe_secret'],
        ])->assertUnprocessable();
    }

    public function test_unauthorized_update_does_not_change_settings(): void
    {
        Setting::set('stripe_secret', 'unchanged_secret', 'string', 'payment');
        Sanctum::actingAs($this->userWithRole('Support'));

        $this->putJson('/api/admin/finance/payment-methods/stripe', [
            'fields' => ['stripe_secret' => 'forbidden_replacement'],
        ])->assertForbidden();

        $this->assertSame('unchanged_secret', Setting::where('key', 'stripe_secret')->value('value'));
    }

    public function test_update_evicts_every_raw_gateway_cache_key(): void
    {
        $keysByGateway = [
            'stripe' => ['stripe_key', 'stripe_secret', 'stripe_webhook_secret'],
            'paypal' => ['paypal_client_id', 'paypal_client_secret', 'paypal_mode', 'paypal_webhook_id', 'paypal_access_token_sandbox', 'paypal_access_token_live'],
            'airwallex' => ['airwallex_client_id', 'airwallex_api_key', 'airwallex_webhook_secret', 'airwallex_mode', 'airwallex_access_token_sandbox', 'airwallex_access_token_live'],
            'payoneer' => ['payoneer_merchant_code', 'payoneer_api_key', 'payoneer_api_secret', 'payoneer_webhook_secret', 'payoneer_mode'],
        ];

        Sanctum::actingAs($this->userWithRole('admin'));
        foreach ($keysByGateway as $gateway => $keys) {
            foreach ($keys as $key) {
                Cache::put($key, 'stale');
            }
            $this->putJson("/api/admin/finance/payment-methods/{$gateway}", [])->assertOk();
            foreach ($keys as $key) {
                $this->assertFalse(Cache::has($key), "Expected {$key} to be evicted.");
            }
        }
    }

    public function test_update_refreshes_checkout_service_credential_and_mode_resolvers(): void
    {
        config()->set('services.stripe.secret', 'stripe_environment_old');
        config()->set('services.paypal.client_id', 'paypal_environment_old');
        config()->set('services.paypal.mode', 'sandbox');
        config()->set('services.airwallex.client_id', 'airwallex_environment_old');
        config()->set('services.airwallex.mode', 'sandbox');
        config()->set('services.payoneer.merchant_code', 'payoneer_environment_old');
        config()->set('services.payoneer.mode', 'sandbox');

        $stripe = app(StripePaymentIntentService::class);
        $paypal = app(PayPalService::class);
        $airwallex = app(AirwallexService::class);
        $payoneer = app(PayoneerService::class);

        $this->assertSame('stripe_environment_old', $this->invokeResolver($stripe, 'stripeSecret'));
        $this->assertSame('paypal_environment_old', $this->invokeResolver($paypal, 'clientId'));
        $this->assertSame('sandbox', $this->invokeResolver($paypal, 'mode'));
        $this->assertSame('airwallex_environment_old', $this->invokeResolver($airwallex, 'clientId'));
        $this->assertSame('sandbox', $this->invokeResolver($airwallex, 'mode'));
        $this->assertSame('payoneer_environment_old', $this->invokeResolver($payoneer, 'merchantCode'));
        $this->assertSame('sandbox', $this->invokeResolver($payoneer, 'mode'));

        Sanctum::actingAs($this->userWithRole('admin'));
        $this->putJson('/api/admin/finance/payment-methods/stripe', [
            'fields' => ['stripe_secret' => 'stripe_database_new'],
        ])->assertOk();
        $this->putJson('/api/admin/finance/payment-methods/paypal', [
            'mode' => 'live',
            'fields' => ['paypal_client_id' => 'paypal_database_new'],
        ])->assertOk();
        $this->putJson('/api/admin/finance/payment-methods/airwallex', [
            'mode' => 'live',
            'fields' => ['airwallex_client_id' => 'airwallex_database_new'],
        ])->assertOk();
        $this->putJson('/api/admin/finance/payment-methods/payoneer', [
            'mode' => 'live',
            'fields' => ['payoneer_merchant_code' => 'payoneer_database_new'],
        ])->assertOk();

        $this->assertSame('stripe_database_new', $this->invokeResolver($stripe, 'stripeSecret'));
        $this->assertSame('paypal_database_new', $this->invokeResolver($paypal, 'clientId'));
        $this->assertSame('live', $this->invokeResolver($paypal, 'mode'));
        $this->assertSame('airwallex_database_new', $this->invokeResolver($airwallex, 'clientId'));
        $this->assertSame('live', $this->invokeResolver($airwallex, 'mode'));
        $this->assertSame('payoneer_database_new', $this->invokeResolver($payoneer, 'merchantCode'));
        $this->assertSame('live', $this->invokeResolver($payoneer, 'mode'));
    }

    public function test_payment_method_test_requires_authentication_denies_business_user_allows_admin_and_rejects_unknown_gateway(): void
    {
        $this->postJson('/api/admin/finance/payment-methods/stripe/test')->assertUnauthorized();

        Role::firstOrCreate(['name' => 'business_user', 'guard_name' => 'web']);
        Sanctum::actingAs($this->userWithRole('business_user'));
        $this->postJson('/api/admin/finance/payment-methods/stripe/test')->assertForbidden();

        config()->set('services.stripe.secret', 'sk_test_payment_method_connection');
        Http::fake([
            'api.stripe.com/*' => Http::response(['available' => [], 'pending' => []]),
        ]);

        Sanctum::actingAs($this->userWithRole('admin'));
        $this->postJson('/api/admin/finance/payment-methods/stripe/test')->assertOk();
        $this->postJson('/api/admin/finance/payment-methods/pingpong/test')->assertNotFound();
    }

    public function test_stripe_connection_test_uses_candidate_secret_without_persisting_or_exposing_it(): void
    {
        $candidateSecret = 'sk_test_candidate_must_not_leak';
        Http::fake([
            'https://api.stripe.com/v1/account' => Http::response(['id' => 'acct_test'], 200),
        ]);

        Sanctum::actingAs($this->userWithRole('admin'));
        $response = $this->postJson('/api/admin/finance/payment-methods/stripe/test', [
            'fields' => ['stripe_secret' => $candidateSecret],
        ])->assertOk()
            ->assertJsonPath('data.gateway', 'stripe')
            ->assertJsonPath('data.status', 'connected');

        Http::assertSent(fn ($request): bool => $request->method() === 'GET'
            && $request->url() === 'https://api.stripe.com/v1/account'
            && $request->hasHeader('Authorization', 'Basic '.base64_encode($candidateSecret.':'))
        );
        $this->assertDatabaseMissing('settings', [
            'key' => 'stripe_secret',
            'value' => $candidateSecret,
        ]);
        $this->assertStringNotContainsString($candidateSecret, $response->getContent());
    }

    public function test_paypal_sandbox_connection_uses_candidate_credentials_without_persisting_or_exposing_them(): void
    {
        $candidateClientId = 'paypal_candidate_client_must_not_leak';
        $candidateSecret = 'paypal_candidate_secret_must_not_leak';

        Http::fake([
            'https://api-m.sandbox.paypal.com/v1/oauth2/token' => Http::response([
                'access_token' => 'provider_token_must_not_leak',
            ], 200),
        ]);

        Sanctum::actingAs($this->userWithRole('admin'));
        $response = $this->postJson('/api/admin/finance/payment-methods/paypal/test', [
            'mode' => 'sandbox',
            'fields' => [
                'paypal_client_id' => $candidateClientId,
                'paypal_client_secret' => $candidateSecret,
            ],
        ])->assertOk()
            ->assertJsonPath('data.gateway', 'paypal')
            ->assertJsonPath('data.status', 'connected')
            ->assertJsonPath('data.mode', 'sandbox');

        Http::assertSent(fn ($request): bool => $request->method() === 'POST'
            && $request->url() === 'https://api-m.sandbox.paypal.com/v1/oauth2/token'
            && $request->hasHeader('Authorization', 'Basic '.base64_encode($candidateClientId.':'.$candidateSecret))
            && $request->hasHeader('Content-Type', 'application/x-www-form-urlencoded')
            && $request['grant_type'] === 'client_credentials'
        );

        $this->assertDatabaseMissing('settings', [
            'key' => 'paypal_client_id',
            'value' => $candidateClientId,
        ]);
        $this->assertDatabaseMissing('settings', [
            'key' => 'paypal_client_secret',
            'value' => $candidateSecret,
        ]);
        $this->assertStringNotContainsString($candidateClientId, $response->getContent());
        $this->assertStringNotContainsString($candidateSecret, $response->getContent());
    }

    public function test_airwallex_sandbox_connection_uses_candidate_credentials_without_persisting_or_exposing_them(): void
    {
        $candidateClientId = 'airwallex_candidate_client_must_not_leak';
        $candidateApiKey = 'airwallex_candidate_key_must_not_leak';

        Http::fake([
            'https://api-demo.airwallex.com/api/v1/authentication/login' => Http::response([
                'token' => 'provider_token_must_not_leak',
            ], 200),
        ]);

        Sanctum::actingAs($this->userWithRole('admin'));
        $response = $this->postJson('/api/admin/finance/payment-methods/airwallex/test', [
            'mode' => 'sandbox',
            'fields' => [
                'airwallex_client_id' => $candidateClientId,
                'airwallex_api_key' => $candidateApiKey,
            ],
        ])->assertOk()
            ->assertJsonPath('data.gateway', 'airwallex')
            ->assertJsonPath('data.status', 'connected')
            ->assertJsonPath('data.mode', 'sandbox');

        Http::assertSent(fn ($request): bool => $request->method() === 'POST'
            && $request->url() === 'https://api-demo.airwallex.com/api/v1/authentication/login'
            && $request->hasHeader('x-client-id', $candidateClientId)
            && $request->hasHeader('x-api-key', $candidateApiKey)
        );

        $this->assertDatabaseMissing('settings', [
            'key' => 'airwallex_client_id',
            'value' => $candidateClientId,
        ]);
        $this->assertDatabaseMissing('settings', [
            'key' => 'airwallex_api_key',
            'value' => $candidateApiKey,
        ]);
        $this->assertStringNotContainsString($candidateClientId, $response->getContent());
        $this->assertStringNotContainsString($candidateApiKey, $response->getContent());
    }

    public function test_payoneer_connection_uses_candidate_credentials_without_http_persistence_or_exposure(): void
    {
        $candidateMerchantCode = 'payoneer_candidate_merchant_must_not_leak';
        $candidateApiKey = 'payoneer_candidate_key_must_not_leak';
        $candidateApiSecret = 'payoneer_candidate_secret_must_not_leak';

        Http::fake();

        Sanctum::actingAs($this->userWithRole('admin'));
        $response = $this->postJson('/api/admin/finance/payment-methods/payoneer/test', [
            'mode' => 'live',
            'fields' => [
                'payoneer_merchant_code' => $candidateMerchantCode,
                'payoneer_api_key' => $candidateApiKey,
                'payoneer_api_secret' => $candidateApiSecret,
            ],
        ])->assertOk()
            ->assertJsonPath('data.gateway', 'payoneer')
            ->assertJsonPath('data.status', 'credentials_present')
            ->assertJsonPath('data.mode', 'live');

        Http::assertNothingSent();

        foreach ([
            'payoneer_merchant_code' => $candidateMerchantCode,
            'payoneer_api_key' => $candidateApiKey,
            'payoneer_api_secret' => $candidateApiSecret,
        ] as $key => $value) {
            $this->assertDatabaseMissing('settings', [
                'key' => $key,
                'value' => $value,
            ]);
            $this->assertStringNotContainsString($value, $response->getContent());
        }
    }

    public function test_stripe_connection_test_resolves_candidate_then_database_then_config_without_leaking_or_persisting_secrets(): void
    {
        $candidateSecret = 'sk_candidate_resolution_must_not_leak';
        $databaseSecret = 'sk_database_resolution_must_not_leak';
        $configSecret = 'sk_config_resolution_must_not_leak';

        config()->set('services.stripe.secret', $configSecret);
        Setting::set('stripe_secret', $databaseSecret, 'string', 'payment');
        Http::fake([
            'https://api.stripe.com/v1/account' => Http::response(['id' => 'acct_resolution'], 200),
        ]);
        Sanctum::actingAs($this->userWithRole('admin'));

        $candidateResponse = $this->postJson('/api/admin/finance/payment-methods/stripe/test', [
            'fields' => ['stripe_secret' => $candidateSecret],
        ])->assertOk();
        $this->assertSame($databaseSecret, Setting::where('key', 'stripe_secret')->value('value'));

        $databaseResponse = $this->postJson('/api/admin/finance/payment-methods/stripe/test', [
            'fields' => ['stripe_secret' => ''],
        ])->assertOk();
        $this->assertSame($databaseSecret, Setting::where('key', 'stripe_secret')->value('value'));

        Setting::query()->where('key', 'stripe_secret')->firstOrFail()->delete();
        $configResponse = $this->postJson('/api/admin/finance/payment-methods/stripe/test', [
            'fields' => ['stripe_secret' => '   '],
        ])->assertOk();
        $this->assertDatabaseMissing('settings', ['key' => 'stripe_secret']);

        foreach ([$candidateSecret, $databaseSecret, $configSecret] as $secret) {
            Http::assertSent(fn ($request): bool => $request->hasHeader('Authorization', 'Basic '.base64_encode($secret.':'))
            );

            foreach ([$candidateResponse, $databaseResponse, $configResponse] as $response) {
                $this->assertStringNotContainsString($secret, $response->getContent());
            }
        }

        foreach ([$candidateResponse, $databaseResponse, $configResponse] as $response) {
            $response->assertJsonMissingPath('verification_token')
                ->assertJsonMissingPath('data.verification_token')
                ->assertJsonMissingPath('data.test_token')
                ->assertJsonMissingPath('data.token');
        }
    }

    public function test_connection_test_sanitizes_provider_rejection_and_transport_failure(): void
    {
        $rejectedSecret = 'sk_rejected_secret_must_not_leak';
        $providerDetail = 'provider_detail_must_not_leak';
        Http::fake([
            'https://api.stripe.com/v1/account' => Http::response([
                'error' => ['message' => $providerDetail],
            ], 401),
        ]);
        Sanctum::actingAs($this->userWithRole('admin'));

        $rejectedResponse = $this->postJson('/api/admin/finance/payment-methods/stripe/test', [
            'fields' => ['stripe_secret' => $rejectedSecret],
        ])->assertUnprocessable()
            ->assertJsonPath('data.status', 'rejected')
            ->assertJsonPath('data.message', 'The payment provider rejected the credentials.')
            ->assertJsonMissingPath('verification_token')
            ->assertJsonMissingPath('data.verification_token')
            ->assertJsonMissingPath('data.test_token')
            ->assertJsonMissingPath('data.token');

        $this->assertStringNotContainsString($rejectedSecret, $rejectedResponse->getContent());
        $this->assertStringNotContainsString($providerDetail, $rejectedResponse->getContent());

        $transportSecret = 'sk_transport_secret_must_not_leak';
        $transportDetail = 'transport_detail_must_not_leak';
        Http::fake(fn () => throw new ConnectionException($transportDetail));

        $transportResponse = $this->postJson('/api/admin/finance/payment-methods/stripe/test', [
            'fields' => ['stripe_secret' => $transportSecret],
        ])->assertStatus(502)
            ->assertJsonPath('data.status', 'connection_error')
            ->assertJsonPath('data.message', 'Unable to connect to the payment provider.')
            ->assertJsonMissingPath('verification_token')
            ->assertJsonMissingPath('data.verification_token')
            ->assertJsonMissingPath('data.test_token')
            ->assertJsonMissingPath('data.token');

        $this->assertStringNotContainsString($transportSecret, $transportResponse->getContent());
        $this->assertStringNotContainsString($transportDetail, $transportResponse->getContent());
        $this->assertDatabaseMissing('settings', ['key' => 'stripe_secret']);
    }

    public function test_live_mode_uses_paypal_and_airwallex_live_endpoints_with_expected_authentication(): void
    {
        $paypalClientId = 'paypal_live_client';
        $paypalClientSecret = 'paypal_live_secret';
        $airwallexClientId = 'airwallex_live_client';
        $airwallexApiKey = 'airwallex_live_key';

        Http::fake([
            'https://api-m.paypal.com/v1/oauth2/token' => Http::response(['access_token' => 'paypal_token'], 200),
            'https://api.airwallex.com/api/v1/authentication/login' => Http::response(['token' => 'airwallex_token'], 200),
        ]);

        Sanctum::actingAs($this->userWithRole('admin'));

        $this->postJson('/api/admin/finance/payment-methods/paypal/test', [
            'mode' => 'live',
            'fields' => [
                'paypal_client_id' => $paypalClientId,
                'paypal_client_secret' => $paypalClientSecret,
            ],
        ])->assertOk()->assertJsonPath('data.mode', 'live');

        $this->postJson('/api/admin/finance/payment-methods/airwallex/test', [
            'mode' => 'live',
            'fields' => [
                'airwallex_client_id' => $airwallexClientId,
                'airwallex_api_key' => $airwallexApiKey,
            ],
        ])->assertOk()->assertJsonPath('data.mode', 'live');

        Http::assertSent(fn ($request): bool => $request->method() === 'POST'
            && $request->url() === 'https://api-m.paypal.com/v1/oauth2/token'
            && $request->hasHeader('Authorization', 'Basic '.base64_encode($paypalClientId.':'.$paypalClientSecret))
            && $request->hasHeader('Content-Type', 'application/x-www-form-urlencoded')
            && $request['grant_type'] === 'client_credentials'
        );

        Http::assertSent(fn ($request): bool => $request->method() === 'POST'
            && $request->url() === 'https://api.airwallex.com/api/v1/authentication/login'
            && $request->hasHeader('x-client-id', $airwallexClientId)
            && $request->hasHeader('x-api-key', $airwallexApiKey)
        );
    }

    public function test_candidate_credentials_never_leak_outside_the_provider_request(): void
    {
        $candidateClientId = 'paypal_security_client_'.uniqid();
        $candidateSecret = 'paypal_security_secret_'.uniqid();
        $loggedPayloads = [];

        Event::listen(MessageLogged::class, function (MessageLogged $event) use (&$loggedPayloads): void {
            $loggedPayloads[] = $event->message;
            $loggedPayloads[] = json_encode($event->context, JSON_THROW_ON_ERROR);
        });

        Http::fake([
            'https://api-m.sandbox.paypal.com/v1/oauth2/token' => Http::response([
                'access_token' => 'provider_access_token',
            ], 200),
        ]);

        Sanctum::actingAs($this->userWithRole('admin'));
        $response = $this->postJson('/api/admin/finance/payment-methods/paypal/test', [
            'mode' => 'sandbox',
            'fields' => [
                'paypal_client_id' => $candidateClientId,
                'paypal_client_secret' => $candidateSecret,
            ],
        ])->assertOk()
            ->assertJsonMissingPath('verification_token')
            ->assertJsonMissingPath('data.verification_token')
            ->assertJsonMissingPath('data.test_token')
            ->assertJsonMissingPath('data.token');

        foreach ([$candidateClientId, $candidateSecret] as $candidate) {
            $this->assertStringNotContainsString($candidate, implode('\n', $loggedPayloads));
            $this->assertDatabaseMissing('settings', ['value' => $candidate]);
            $this->assertStringNotContainsString($candidate, $response->getContent());
        }

        foreach ([
            'paypal_client_id',
            'paypal_client_secret',
            'paypal_mode',
            'paypal_webhook_id',
            'paypal_access_token_sandbox',
            'paypal_access_token_live',
        ] as $cacheKey) {
            $cached = Cache::get($cacheKey);
            $serialized = is_scalar($cached) || $cached === null ? (string) $cached : json_encode($cached, JSON_THROW_ON_ERROR);

            $this->assertStringNotContainsString($candidateClientId, $serialized, "Candidate client ID leaked through cache key {$cacheKey}.");
            $this->assertStringNotContainsString($candidateSecret, $serialized, "Candidate secret leaked through cache key {$cacheKey}.");
        }

        Http::assertSent(function ($request) use ($candidateClientId, $candidateSecret): bool {
            $url = $request->url();

            $this->assertStringNotContainsString($candidateClientId, $url);
            $this->assertStringNotContainsString($candidateSecret, $url);

            return true;
        });
    }

    private function invokeResolver(object $service, string $method): mixed
    {
        $reflection = new ReflectionMethod($service, $method);
        $reflection->setAccessible(true);

        return $reflection->invoke($service);
    }

    private function userWithRole(string $role): User
    {
        $user = User::factory()->create();
        $user->assignRole($role);

        return $user;
    }
}
