<?php

namespace Tests\Feature\Api\Admin;

use App\Models\Setting;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
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

    private function userWithRole(string $role): User
    {
        $user = User::factory()->create();
        $user->assignRole($role);

        return $user;
    }
}
