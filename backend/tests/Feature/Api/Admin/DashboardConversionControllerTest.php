<?php

namespace Tests\Feature\Api\Admin;

use App\Models\CheckoutSession;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Lunar\Models\Cart;
use Lunar\Models\Channel;
use Lunar\Models\Currency;
use Lunar\Models\Order;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class DashboardConversionControllerTest extends TestCase
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

    public function test_unauthenticated_request_is_rejected(): void
    {
        $this->getJson('/api/admin/dashboard/conversion')->assertUnauthorized();
    }

    public function test_customer_cannot_access_dashboard_conversion(): void
    {
        Sanctum::actingAs($this->userWithRole('customer'));

        $this->getJson('/api/admin/dashboard/conversion')->assertForbidden();
    }

    public function test_product_manager_cannot_access_dashboard_conversion(): void
    {
        Sanctum::actingAs($this->userWithRole('Product Manager'));

        $this->getJson('/api/admin/dashboard/conversion')->assertForbidden();
    }

    public function test_order_manager_can_access_dashboard_conversion(): void
    {
        Sanctum::actingAs($this->userWithRole('Order Manager'));

        $this->getJson('/api/admin/dashboard/conversion')->assertOk();
    }

    public function test_support_can_access_dashboard_conversion(): void
    {
        Sanctum::actingAs($this->userWithRole('Support'));

        $this->getJson('/api/admin/dashboard/conversion')->assertOk();
    }

    public function test_core_admin_can_access_dashboard_conversion(): void
    {
        Sanctum::actingAs($this->userWithRole('admin'));

        $this->getJson('/api/admin/dashboard/conversion')->assertOk();
    }

    public function test_range_validation_rejects_invalid_values(): void
    {
        Sanctum::actingAs($this->userWithRole('admin'));

        $this->getJson('/api/admin/dashboard/conversion?range=invalid')
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['range']);
    }

    public function test_range_validation_rejects_365_option(): void
    {
        Sanctum::actingAs($this->userWithRole('admin'));

        $this->getJson('/api/admin/dashboard/conversion?range=365')
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['range']);
    }

    public function test_all_supported_ranges_work_and_default_is_30(): void
    {
        Sanctum::actingAs($this->userWithRole('admin'));

        // Default when omitted
        $defaultResponse = $this->getJson('/api/admin/dashboard/conversion')->assertOk();
        $this->assertSame('30', $defaultResponse->json('data.range'));

        // Supported ranges
        foreach (['7', '30', '90', 'all'] as $range) {
            $response = $this->getJson("/api/admin/dashboard/conversion?range={$range}")->assertOk();
            $this->assertSame($range, $response->json('data.range'));
        }
    }

    public function test_stage_counts_match_database_with_date_filtering(): void
    {
        Sanctum::actingAs($this->userWithRole('admin'));

        $currency = Currency::getDefault();
        $channel = Channel::getDefault();

        // 1. Carts: 4 inside 30d window, 1 outside (35 days ago)
        for ($i = 0; $i < 4; $i++) {
            Cart::create([
                'currency_id' => $currency->id,
                'channel_id' => $channel->id,
                'created_at' => now()->subDays(5 + $i),
            ]);
        }
        Cart::create([
            'currency_id' => $currency->id,
            'channel_id' => $channel->id,
            'created_at' => now()->subDays(35),
        ]);

        // 2. CheckoutSessions:
        // Inside 30d:
        // - 1 'open' (started checkout)
        // - 1 'expired' (started checkout, then expired — must be included!)
        // - 1 'cart' (never started checkout — must be excluded!)
        // Outside 30d:
        // - 1 'open' (35 days ago — excluded by date)
        $this->createCheckoutSession([
            'token' => Str::random(32),
            'status' => 'open',
            'created_at' => now()->subDays(3),
        ]);
        $this->createCheckoutSession([
            'token' => Str::random(32),
            'status' => 'expired',
            'created_at' => now()->subDays(4),
        ]);
        $this->createCheckoutSession([
            'token' => Str::random(32),
            'status' => 'cart',
            'created_at' => now()->subDays(2),
        ]);
        $this->createCheckoutSession([
            'token' => Str::random(32),
            'status' => 'open',
            'created_at' => now()->subDays(35),
        ]);

        // 3. Orders:
        // Inside 30d:
        // - 1 'placed' (completed order)
        // - 1 'cancelled' (must be excluded!)
        // Outside 30d:
        // - 1 'placed' (35 days ago — excluded by date)
        Order::factory()->create([
            'status' => 'placed',
            'created_at' => now()->subDays(2),
        ]);
        Order::factory()->create([
            'status' => 'cancelled',
            'created_at' => now()->subDays(1),
        ]);
        Order::factory()->create([
            'status' => 'placed',
            'created_at' => now()->subDays(35),
        ]);

        $response = $this->getJson('/api/admin/dashboard/conversion?range=30')->assertOk();

        // Direct DB assertions for 30d window
        $expectedCarts = Cart::where('created_at', '>=', now()->subDays(30))->count();
        $expectedCheckouts = CheckoutSession::where('status', '!=', 'cart')
            ->where('created_at', '>=', now()->subDays(30))
            ->count();
        $expectedOrders = Order::whereNotIn('status', ['cancelled'])
            ->where('created_at', '>=', now()->subDays(30))
            ->count();

        $this->assertSame(4, $expectedCarts);
        $this->assertSame(2, $expectedCheckouts);
        $this->assertSame(1, $expectedOrders);

        $this->assertSame($expectedCarts, $response->json('data.carts_created'));
        $this->assertSame($expectedCheckouts, $response->json('data.checkouts_started'));
        $this->assertSame($expectedOrders, $response->json('data.orders_completed'));

        // Rates:
        // cart_abandonment_rate = (4 - 2) / 4 = 0.5
        // checkout_abandonment_rate = (2 - 1) / 2 = 0.5
        $this->assertEquals(0.5, $response->json('data.cart_abandonment_rate'));
        $this->assertEquals(0.5, $response->json('data.checkout_abandonment_rate'));
    }

    public function test_cart_and_checkout_abandonment_rates_are_distinct_fields_with_distinct_values(): void
    {
        Sanctum::actingAs($this->userWithRole('admin'));

        $currency = Currency::getDefault();
        $channel = Channel::getDefault();

        // 100 carts created
        for ($i = 0; $i < 10; $i++) {
            Cart::create([
                'currency_id' => $currency->id,
                'channel_id' => $channel->id,
                'created_at' => now()->subDays(1),
            ]);
        }

        // 8 checkout sessions started (e.g. 5 'open', 3 'expired')
        for ($i = 0; $i < 5; $i++) {
            $this->createCheckoutSession([
                'token' => Str::random(32),
                'status' => 'open',
                'created_at' => now()->subDays(1),
            ]);
        }
        for ($i = 0; $i < 3; $i++) {
            $this->createCheckoutSession([
                'token' => Str::random(32),
                'status' => 'expired',
                'created_at' => now()->subDays(1),
            ]);
        }

        // 3 completed orders
        for ($i = 0; $i < 3; $i++) {
            Order::factory()->create([
                'status' => 'delivered',
                'created_at' => now()->subDays(1),
            ]);
        }

        $response = $this->getJson('/api/admin/dashboard/conversion?range=7')->assertOk();

        $data = $response->json('data');

        $this->assertSame(10, $data['carts_created']);
        $this->assertSame(8, $data['checkouts_started']);
        $this->assertSame(3, $data['orders_completed']);

        // cart drop-off: (10 - 8) / 10 = 0.2 (20% cart abandonment)
        // checkout drop-off: (8 - 3) / 8 = 0.625 (62.5% checkout abandonment)
        $this->assertEquals(0.2, $data['cart_abandonment_rate']);
        $this->assertEquals(0.625, $data['checkout_abandonment_rate']);
        $this->assertNotEquals($data['cart_abandonment_rate'], $data['checkout_abandonment_rate']);
    }

    public function test_range_all_includes_all_records_without_date_cutoff(): void
    {
        Sanctum::actingAs($this->userWithRole('admin'));

        $currency = Currency::getDefault();
        $channel = Channel::getDefault();

        Cart::create([
            'currency_id' => $currency->id,
            'channel_id' => $channel->id,
            'created_at' => now()->subDays(400),
        ]);

        $this->createCheckoutSession([
            'token' => Str::random(32),
            'status' => 'confirmed',
            'created_at' => now()->subDays(400),
        ]);

        Order::factory()->create([
            'status' => 'delivered',
            'created_at' => now()->subDays(400),
        ]);

        $response = $this->getJson('/api/admin/dashboard/conversion?range=all')->assertOk();

        $this->assertGreaterThanOrEqual(1, $response->json('data.carts_created'));
        $this->assertGreaterThanOrEqual(1, $response->json('data.checkouts_started'));
        $this->assertGreaterThanOrEqual(1, $response->json('data.orders_completed'));
    }

    public function test_zero_activity_returns_zero_rates_without_division_by_zero(): void
    {
        Sanctum::actingAs($this->userWithRole('admin'));

        $response = $this->getJson('/api/admin/dashboard/conversion?range=7')->assertOk();

        $this->assertSame(0, $response->json('data.carts_created'));
        $this->assertSame(0, $response->json('data.checkouts_started'));
        $this->assertSame(0, $response->json('data.orders_completed'));
        $this->assertEquals(0.0, $response->json('data.cart_abandonment_rate'));
        $this->assertEquals(0.0, $response->json('data.checkout_abandonment_rate'));
    }

    public function test_no_customer_pii_appears_in_conversion_response(): void
    {
        Sanctum::actingAs($this->userWithRole('admin'));

        $currency = Currency::getDefault();
        $channel = Channel::getDefault();

        $user = User::factory()->create([
            'name' => 'Secret Customer Name',
            'email' => 'secret_customer@example.com',
        ]);

        Cart::create([
            'user_id' => $user->id,
            'currency_id' => $currency->id,
            'channel_id' => $channel->id,
            'created_at' => now()->subDays(1),
        ]);

        $this->createCheckoutSession([
            'token' => 'sensitive_checkout_session_token_123',
            'user_id' => $user->id,
            'status' => 'paid',
            'order_reference' => 'ORD-SECRET-999',
            'created_at' => now()->subDays(1),
        ]);

        Order::factory()->create([
            'user_id' => $user->id,
            'status' => 'delivered',
            'created_at' => now()->subDays(1),
        ]);

        $response = $this->getJson('/api/admin/dashboard/conversion?range=30')->assertOk();
        $jsonString = json_encode($response->json());

        // PII strings must NOT appear
        $this->assertStringNotContainsString('secret_customer@example.com', $jsonString);
        $this->assertStringNotContainsString('Secret Customer Name', $jsonString);
        $this->assertStringNotContainsString('sensitive_checkout_session_token_123', $jsonString);
        $this->assertStringNotContainsString('ORD-SECRET-999', $jsonString);

        // Keys must ONLY be aggregate metrics
        $keys = array_keys($response->json('data'));
        sort($keys);
        $expectedKeys = [
            'cart_abandonment_rate',
            'carts_created',
            'checkout_abandonment_rate',
            'checkouts_started',
            'orders_completed',
            'range',
        ];
        sort($expectedKeys);
        $this->assertSame($expectedKeys, $keys);
    }

    private function userWithRole(string $role): User
    {
        $user = User::factory()->create();
        $user->assignRole($role);

        return $user;
    }

    private function createCheckoutSession(array $attributes): CheckoutSession
    {
        $createdAt = $attributes['created_at'] ?? null;
        unset($attributes['created_at']);

        $session = CheckoutSession::create($attributes);

        if ($createdAt) {
            $session->timestamps = false;
            $session->created_at = $createdAt;
            $session->save();
        }

        return $session;
    }
}
