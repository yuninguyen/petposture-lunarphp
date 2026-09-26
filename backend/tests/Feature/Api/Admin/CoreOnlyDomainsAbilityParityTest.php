<?php

declare(strict_types=1);

namespace Tests\Feature\Api\Admin;

use App\Models\Discount;
use App\Models\ShippingMethod;
use App\Models\User;
use App\Security\AdminAbilityRegistry;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Lunar\DiscountTypes\AmountOff;
use Lunar\Models\Address;
use Lunar\Models\Customer;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class CoreOnlyDomainsAbilityParityTest extends TestCase
{
    use RefreshDatabase;

    private const ALLOWED = ['super_admin', 'admin', 'staff'];

    private const BLOCKED = ['Product Manager', 'Order Manager', 'Support', 'customer'];

    private const DOMAINS = [
        'CUSTOMERS' => '2026_09_24_000001_seed_customers_domain_permissions.php',
        'SETTINGS_GENERAL' => '2026_09_24_000002_seed_settings_general_domain_permissions.php',
        'SETTINGS_BRANDING' => '2026_09_24_000003_seed_settings_branding_domain_permissions.php',
        'SETTINGS_ANALYTICS' => '2026_09_24_000004_seed_settings_analytics_domain_permissions.php',
        'SETTINGS_SMTP' => '2026_09_24_000005_seed_settings_smtp_domain_permissions.php',
        'SETTINGS_AI' => '2026_09_24_000006_seed_settings_ai_domain_permissions.php',
        'FINANCE_PAYMENT_METHODS' => '2026_09_24_000007_seed_finance_payment_methods_domain_permissions.php',
        'SHIPPING_METHODS' => '2026_09_24_000008_seed_shipping_methods_domain_permissions.php',
        'DISCOUNTS' => '2026_09_24_000009_seed_discounts_domain_permissions.php',
    ];

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
    }

    public function test_core_roles_can_enter_and_non_core_roles_are_forbidden_for_every_route(): void
    {
        foreach (self::ALLOWED as $role) {
            foreach ($this->requests() as [$method, $uri, $payload]) {
                $this->actAs($role);
                $this->assertNotSame(403, $this->{$method}($uri, $payload)->getStatusCode(), "$role: $method $uri");
            }
        }
        foreach (self::BLOCKED as $role) {
            foreach ($this->requests() as [$method, $uri, $payload]) {
                $this->actAs($role);
                $this->assertSame(403, $this->{$method}($uri, $payload)->getStatusCode(), "$role: $method $uri");
            }
        }
    }

    public function test_unauthenticated_requests_are_unauthorized(): void
    {
        foreach ($this->requests() as [$method, $uri, $payload]) {
            $this->{$method}($uri, $payload)->assertUnauthorized();
        }
    }

    public function test_each_migration_assigns_only_core_roles(): void
    {
        foreach (self::DOMAINS as $constant => $migration) {
            (require database_path("migrations/$migration"))->up();
            $abilities = constant(AdminAbilityRegistry::class.'::'.$constant);
            foreach (self::ALLOWED as $role) {
                foreach ($abilities as $ability) {
                    $this->assertTrue(Role::findByName($role)->hasPermissionTo($ability), "$role: $ability");
                }
            }
            foreach (self::BLOCKED as $role) {
                foreach ($abilities as $ability) {
                    $this->assertFalse(Role::findByName($role)->hasPermissionTo($ability), "$role: $ability");
                }
            }
        }
    }

    private function requests(): array
    {
        $customer = Customer::factory()->create();
        $address = Address::factory()->create(['customer_id' => $customer->id]);
        $loginAccount = User::factory()->create();
        $shippingMethod = ShippingMethod::query()->create(['code' => 'parity-'.uniqid(), 'name' => 'Parity', 'eta' => '1 day', 'price' => 0, 'free_over' => 0]);
        $discount = Discount::query()->create(['name' => 'Parity', 'handle' => 'parity-'.uniqid(), 'type' => AmountOff::class, 'starts_at' => now(), 'data' => []]);

        return [
            ['getJson', '/api/admin/customers', []], ['getJson', "/api/admin/customers/{$customer->id}", []], ['getJson', "/api/admin/customers/{$customer->id}/orders", []], ['getJson', "/api/admin/customers/{$customer->id}/addresses", []], ['getJson', "/api/admin/customers/{$customer->id}/login-accounts", []], ['putJson', "/api/admin/customers/{$customer->id}/login-accounts/{$loginAccount->id}", []], ['patchJson', "/api/admin/customers/{$customer->id}/addresses/{$address->id}", []], ['deleteJson', "/api/admin/customers/{$customer->id}/addresses/{$address->id}", []], ['putJson', "/api/admin/customers/{$customer->id}", []],
            ['getJson', '/api/admin/settings/general', []], ['putJson', '/api/admin/settings/general', []], ['getJson', '/api/admin/settings/branding', []], ['putJson', '/api/admin/settings/branding', []], ['getJson', '/api/admin/settings/analytics', []], ['putJson', '/api/admin/settings/analytics', []], ['getJson', '/api/admin/settings/smtp', []], ['putJson', '/api/admin/settings/smtp', []], ['postJson', '/api/admin/settings/smtp/test', []], ['getJson', '/api/admin/settings/ai', []], ['putJson', '/api/admin/settings/ai', []], ['postJson', '/api/admin/settings/ai/fetch-models', []],
            ['getJson', '/api/admin/finance/payment-methods', []], ['putJson', '/api/admin/finance/payment-methods/stripe', []], ['postJson', '/api/admin/finance/payment-methods/stripe/test', []],
            ['getJson', '/api/admin/shipping-methods', []], ['postJson', '/api/admin/shipping-methods', []], ['getJson', "/api/admin/shipping-methods/{$shippingMethod->id}", []], ['putJson', "/api/admin/shipping-methods/{$shippingMethod->id}", []], ['patchJson', "/api/admin/shipping-methods/{$shippingMethod->id}", []], ['deleteJson', "/api/admin/shipping-methods/{$shippingMethod->id}", []],
            ['getJson', '/api/admin/discounts', []], ['postJson', '/api/admin/discounts', []], ['getJson', "/api/admin/discounts/{$discount->id}", []], ['putJson', "/api/admin/discounts/{$discount->id}", []], ['patchJson', "/api/admin/discounts/{$discount->id}", []], ['deleteJson', "/api/admin/discounts/{$discount->id}", []],
        ];
    }

    private function actAs(string $role): void
    {
        $user = User::factory()->create();
        $user->assignRole($role);
        Sanctum::actingAs($user);
    }
}
