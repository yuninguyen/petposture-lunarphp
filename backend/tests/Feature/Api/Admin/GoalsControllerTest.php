<?php

namespace Tests\Feature\Api\Admin;

use App\Models\Setting;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Lunar\Models\Order;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class GoalsControllerTest extends TestCase
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
        $this->getJson('/api/admin/goals')->assertUnauthorized();
        $this->putJson('/api/admin/goals', [])->assertUnauthorized();
    }

    public function test_customer_cannot_access_goals(): void
    {
        Sanctum::actingAs($this->userWithRole('customer'));

        $this->getJson('/api/admin/goals')->assertForbidden();
        $this->putJson('/api/admin/goals', [])->assertForbidden();
    }

    public function test_business_roles_cannot_access_goals(): void
    {
        Sanctum::actingAs($this->userWithRole('Product Manager'));
        $this->getJson('/api/admin/goals')->assertForbidden();

        Sanctum::actingAs($this->userWithRole('Order Manager'));
        $this->getJson('/api/admin/goals')->assertForbidden();

        Sanctum::actingAs($this->userWithRole('Support'));
        $this->getJson('/api/admin/goals')->assertForbidden();
    }

    public function test_core_admin_can_get_goals_with_unconfigured_targets(): void
    {
        Sanctum::actingAs($this->userWithRole('admin'));

        Setting::whereIn('key', [
            'monthly_revenue_target',
            'monthly_orders_target',
            'monthly_new_customers_target',
        ])->delete();

        $response = $this->getJson('/api/admin/goals')->assertOk();

        $response->assertJsonStructure([
            'data' => [
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

        $goals = collect($response->json('data.goals'))->keyBy('key');

        $this->assertTrue($goals->has('monthly_revenue_target'));
        $this->assertTrue($goals->has('monthly_orders_target'));
        $this->assertTrue($goals->has('monthly_new_customers_target'));

        $this->assertNull($goals['monthly_revenue_target']['target']);
        $this->assertNull($goals['monthly_revenue_target']['percent']);
        $this->assertNull($goals['monthly_revenue_target']['uncapped_percent']);
        $this->assertSame('currency', $goals['monthly_revenue_target']['unit']);

        $this->assertNull($goals['monthly_orders_target']['target']);
        $this->assertSame('number', $goals['monthly_orders_target']['unit']);

        $this->assertNull($goals['monthly_new_customers_target']['target']);
        $this->assertSame('number', $goals['monthly_new_customers_target']['unit']);
    }

    public function test_goals_calculates_both_capped_and_uncapped_percentages(): void
    {
        Sanctum::actingAs($this->userWithRole('admin'));

        Setting::set('monthly_revenue_target', 100, 'int', 'goals');
        Setting::set('monthly_orders_target', 2, 'int', 'goals');

        // Create 3 orders this month totaling $150.00
        Order::factory()->count(3)->create([
            'status' => 'delivered',
            'total' => 5000,
            'placed_at' => now(),
            'created_at' => now(),
        ]);

        $response = $this->getJson('/api/admin/goals')->assertOk();
        $goals = collect($response->json('data.goals'))->keyBy('key');

        $rev = $goals['monthly_revenue_target'];
        $this->assertEquals(150.0, $rev['actual']);
        $this->assertEquals(100.0, $rev['target']);
        // Capped percentage is 100 for display, uncapped is 150.0
        $this->assertEquals(100, $rev['percent']);
        $this->assertEquals(150.0, $rev['uncapped_percent']);

        $orders = $goals['monthly_orders_target'];
        $this->assertEquals(3, $orders['actual']);
        $this->assertEquals(2, $orders['target']);
        $this->assertEquals(100, $orders['percent']);
        $this->assertEquals(150.0, $orders['uncapped_percent']);
    }

    public function test_put_goals_updates_settings_and_distinguishes_zero_from_null(): void
    {
        Sanctum::actingAs($this->userWithRole('admin'));

        $payload = [
            'monthly_revenue_target' => 0,
            'monthly_orders_target' => null,
            'monthly_new_customers_target' => 25,
        ];

        $response = $this->putJson('/api/admin/goals', $payload)->assertOk();
        $goals = collect($response->json('data.goals'))->keyBy('key');

        // Target explicitly 0 vs unconfigured (null)
        $this->assertSame(0.0, (float) $goals['monthly_revenue_target']['target']);
        $this->assertNull($goals['monthly_orders_target']['target']);
        $this->assertEquals(25, $goals['monthly_new_customers_target']['target']);

        // Check settings table directly
        $revSetting = Setting::where('key', 'monthly_revenue_target')->first();
        $this->assertNotNull($revSetting);
        $this->assertEquals(0, $revSetting->cast_value);

        $ordersSetting = Setting::where('key', 'monthly_orders_target')->first();
        $this->assertNull($ordersSetting);

        $custSetting = Setting::where('key', 'monthly_new_customers_target')->first();
        $this->assertNotNull($custSetting);
        $this->assertEquals(25, $custSetting->cast_value);
    }

    public function test_put_goals_validates_numeric_and_min_zero(): void
    {
        Sanctum::actingAs($this->userWithRole('admin'));

        $this->putJson('/api/admin/goals', [
            'monthly_revenue_target' => 'not-a-number',
        ])->assertUnprocessable()->assertJsonValidationErrors(['monthly_revenue_target']);

        $this->putJson('/api/admin/goals', [
            'monthly_orders_target' => -5,
        ])->assertUnprocessable()->assertJsonValidationErrors(['monthly_orders_target']);
    }

    private function userWithRole(string $role): User
    {
        $user = User::factory()->create();
        $user->assignRole($role);

        return $user;
    }
}
