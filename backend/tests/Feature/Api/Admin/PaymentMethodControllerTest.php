<?php

namespace Tests\Feature\Api\Admin;

use App\Models\Setting;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Laravel\Sanctum\Sanctum;
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

    private function userWithRole(string $role): User
    {
        $user = User::factory()->create();
        $user->assignRole($role);

        return $user;
    }
}
