<?php

namespace Tests\Feature\Api\Admin;

use App\Models\OrderReturnRequest;
use App\Models\Review;
use App\Models\Setting;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Lunar\Models\Collection;
use Lunar\Models\Order;
use Lunar\Models\OrderLine;
use Lunar\Models\Price;
use Lunar\Models\Product;
use Lunar\Models\ProductVariant;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class DashboardSalesControllerTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(RoleSeeder::class);

        foreach (['super_admin', 'admin', 'staff', 'Product Manager', 'Order Manager', 'Support', 'customer'] as $role) {
            Role::firstOrCreate(['name' => $role, 'guard_name' => 'web']);
        }

        // The 2026_05_22_000001_ensure_lunar_default_records migration already
        // seeds a default USD currency when none exists; RefreshDatabase runs
        // migrations fresh per test, so creating another one here duplicates
        // the unique `code` and fails every test in this class.
    }

    public function test_unauthenticated_request_is_rejected(): void
    {
        $this->getJson('/api/admin/dashboard/sales')->assertUnauthorized();
    }

    public function test_customer_cannot_access_dashboard_sales(): void
    {
        Sanctum::actingAs($this->userWithRole('customer'));

        $this->getJson('/api/admin/dashboard/sales')->assertForbidden();
    }

    public function test_product_manager_cannot_access_dashboard_sales(): void
    {
        Sanctum::actingAs($this->userWithRole('Product Manager'));

        $this->getJson('/api/admin/dashboard/sales')->assertForbidden();
    }

    public function test_order_manager_can_access_dashboard_sales(): void
    {
        Sanctum::actingAs($this->userWithRole('Order Manager'));

        $this->getJson('/api/admin/dashboard/sales')->assertOk();
    }

    public function test_core_admin_can_access_dashboard_sales(): void
    {
        Sanctum::actingAs($this->userWithRole('admin'));

        $this->getJson('/api/admin/dashboard/sales')->assertOk();
    }

    public function test_range_validation_rejects_invalid_values(): void
    {
        Sanctum::actingAs($this->userWithRole('admin'));

        $this->getJson('/api/admin/dashboard/sales?range=invalid')
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['range']);
    }

    public function test_response_shape_matches_all_live_widgets(): void
    {
        Sanctum::actingAs($this->userWithRole('admin'));

        Setting::set('monthly_revenue_target', 5000, 'int', 'goals');
        Setting::set('monthly_orders_target', 100, 'int', 'goals');
        Setting::set('monthly_new_customers_target', 20, 'int', 'goals');

        $order = Order::factory()->create([
            'status' => 'delivered',
            'total' => 15000,
            'sub_total' => 14000,
            'placed_at' => now()->subDays(2),
            'created_at' => now()->subDays(2),
        ]);

        $line = OrderLine::factory()->create([
            'order_id' => $order->id,
            'type' => 'physical',
            'description' => 'Pet Harness Pro',
            'identifier' => 'PH-01',
            'quantity' => 2,
            'sub_total' => 14000,
            'unit_price' => 7000,
        ]);

        OrderReturnRequest::create([
            'order_id' => $order->id,
            'status' => OrderReturnRequest::STATUS_REQUESTED,
            'reason' => 'Defective',
            'requested_at' => now()->subDay(),
        ]);

        $response = $this->getJson('/api/admin/dashboard/sales?range=30')->assertOk();

        $response->assertJsonStructure([
            'data' => [
                'range',
                'currency',
                'stats' => [
                    'sales' => ['raw', 'decimal', 'currency', 'trend'],
                    'orders' => ['count', 'trend'],
                    'aov' => ['raw', 'decimal', 'currency', 'trend'],
                    'active_users' => ['value', 'status', 'formatted'],
                ],
                'sales_over_time' => [
                    'granularity',
                    'categories',
                    'series' => [
                        'revenue',
                        'orders',
                    ],
                ],
                'returns_summary' => [
                    'refund_rate',
                    'refund_trend',
                    'pending_review',
                    'overdue',
                    'awaiting_completion',
                ],
                'order_pipeline' => [
                    'awaiting_payment',
                    'processing',
                    'shipped',
                    'delivered',
                ],
                'top_products' => [
                    '*' => [
                        'id',
                        'description',
                        'sku',
                        'quantity',
                        'revenue' => ['raw', 'decimal', 'currency'],
                    ],
                ],
                'sales_by_category' => [
                    '*' => [
                        'name',
                        'revenue' => ['raw', 'decimal', 'currency'],
                    ],
                ],
                'recent_orders' => [
                    '*' => [
                        'id',
                        'reference',
                        'customer_name',
                        'status',
                        'total' => ['raw', 'decimal', 'currency'],
                        'placed_at',
                        'created_at',
                    ],
                ],
                'recent_activity' => [
                    '*' => [
                        'icon',
                        'color',
                        'title',
                        'description',
                        'at',
                    ],
                ],
                'traffic_sources' => [
                    'status',
                    'items' => [
                        '*' => ['label', 'percent', 'color'],
                    ],
                ],
                'goals' => [
                    '*' => [
                        'key',
                        'label',
                        'actual',
                        'target',
                        'percent',
                        'uncapped_percent',
                        'unit',
                    ],
                ],
            ],
        ]);

        $this->assertNull($response->json('data.stats.active_users.value'));
        $this->assertSame('not_connected', $response->json('data.stats.active_users.status'));
        $this->assertSame('—', $response->json('data.stats.active_users.formatted'));
    }

    public function test_cancelled_orders_are_excluded_from_every_sales_metric(): void
    {
        Sanctum::actingAs($this->userWithRole('admin'));

        $validOrder = Order::factory()->create([
            'status' => 'delivered',
            'total' => 10000,
            'sub_total' => 10000,
            'placed_at' => now()->subDays(3),
            'created_at' => now()->subDays(3),
        ]);

        OrderLine::factory()->create([
            'order_id' => $validOrder->id,
            'type' => 'physical',
            'description' => 'Valid Bed',
            'identifier' => 'BED-V',
            'quantity' => 1,
            'sub_total' => 10000,
            'unit_price' => 10000,
        ]);

        $cancelledOrder = Order::factory()->create([
            'status' => 'cancelled',
            'total' => 99000,
            'sub_total' => 99000,
            'placed_at' => now()->subDays(2),
            'created_at' => now()->subDays(2),
        ]);

        OrderLine::factory()->create([
            'order_id' => $cancelledOrder->id,
            'type' => 'physical',
            'description' => 'Cancelled Bed',
            'identifier' => 'BED-C',
            'quantity' => 10,
            'sub_total' => 99000,
            'unit_price' => 9900,
        ]);

        $response = $this->getJson('/api/admin/dashboard/sales?range=30')->assertOk();

        // Total sales must only be 10000 cents ($100.00), not 109000 cents
        $this->assertEquals(10000, $response->json('data.stats.sales.raw'));
        $this->assertEquals(100.0, $response->json('data.stats.sales.decimal'));
        $this->assertEquals(1, $response->json('data.stats.orders.count'));
        $this->assertEquals(100.0, $response->json('data.stats.aov.decimal'));

        // Top products must NOT contain Cancelled Bed
        $topSkus = collect($response->json('data.top_products'))->pluck('sku')->all();
        $this->assertContains('BED-V', $topSkus);
        $this->assertNotContains('BED-C', $topSkus);

        // Recent orders must NOT contain cancelled orders
        $recentStatuses = collect($response->json('data.recent_orders'))->pluck('status')->all();
        $this->assertNotContains('cancelled', $recentStatuses);
    }

    public function test_no_affiliate_data_appears_in_sales_response(): void
    {
        Sanctum::actingAs($this->userWithRole('admin'));

        $response = $this->getJson('/api/admin/dashboard/sales?range=30')->assertOk();
        $json = json_encode($response->json());

        $this->assertStringNotContainsString('affiliate_clicks', $json);
        $this->assertStringNotContainsString('clicks_by_network', $json);
        $this->assertStringNotContainsString('top_clicked_posts', $json);
    }

    public function test_all_supported_ranges_work(): void
    {
        Sanctum::actingAs($this->userWithRole('admin'));

        foreach (['7', '30', '90', '365', 'all'] as $range) {
            $response = $this->getJson("/api/admin/dashboard/sales?range={$range}")->assertOk();
            $this->assertSame($range, $response->json('data.range'));
        }
    }

    private function userWithRole(string $role): User
    {
        $user = User::factory()->create();
        $user->assignRole($role);

        return $user;
    }
}
