<?php

namespace Tests\Feature\Api\Admin;

use App\Models\OrderReturnRequest;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Laravel\Sanctum\Sanctum;
use Lunar\Models\Order;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class DashboardSalesPresetControllerTest extends TestCase
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

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    public function test_each_preset_resolves_to_correct_start_and_end_dates(): void
    {
        Sanctum::actingAs($this->userWithRole('admin'));

        // 2026-09-14 is a Monday, in Q3 2026
        Carbon::setTestNow('2026-09-14 10:00:00');

        $expected = [
            'today' => ['2026-09-14', '2026-09-14', 'Today'],
            'yesterday' => ['2026-09-13', '2026-09-13', 'Yesterday'],
            'last_7_days' => ['2026-09-08', '2026-09-14', 'Last 7 days'],
            'last_30_days' => ['2026-08-16', '2026-09-14', 'Last 30 days'],
            'last_90_days' => ['2026-06-17', '2026-09-14', 'Last 90 days'],
            'last_365_days' => ['2025-09-15', '2026-09-14', 'Last 365 days'],
            'last_week' => ['2026-09-07', '2026-09-13', 'Last week'],
            'last_month' => ['2026-08-01', '2026-08-31', 'Last month'],
            'last_quarter' => ['2026-04-01', '2026-06-30', 'Last quarter'],
            'last_12_months' => ['2025-09-01', '2026-09-14', 'Last 12 months'],
            'last_year' => ['2025-01-01', '2025-12-31', 'Last year'],
            'week_to_date' => ['2026-09-14', '2026-09-14', 'Week to date'],
            'month_to_date' => ['2026-09-01', '2026-09-14', 'Month to date'],
            'quarter_to_date' => ['2026-07-01', '2026-09-14', 'Quarter to date'],
            'year_to_date' => ['2026-01-01', '2026-09-14', 'Year to date'],
        ];

        foreach ($expected as $preset => [$expectedStart, $expectedEnd, $expectedLabel]) {
            $response = $this->getJson("/api/admin/dashboard/sales?preset={$preset}")->assertOk();

            $this->assertSame($preset, $response->json('data.range.preset'), "Preset {$preset} mismatch");
            $this->assertSame($expectedStart, $response->json('data.range.start'), "Preset {$preset} start mismatch");
            $this->assertSame($expectedEnd, $response->json('data.range.end'), "Preset {$preset} end mismatch");
            $this->assertSame($expectedLabel, $response->json('data.range.label'), "Preset {$preset} label mismatch");
            $this->assertFalse($response->json('data.range.comparison_active'), "Preset {$preset} comparison_active should be false by default");
        }
    }

    public function test_last_month_around_month_end_edge_case(): void
    {
        Sanctum::actingAs($this->userWithRole('admin'));

        // Freeze on March 31, 2026 — testing subMonthNoOverflow does not roll into March
        Carbon::setTestNow('2026-03-31 15:00:00');

        $response = $this->getJson('/api/admin/dashboard/sales?preset=last_month')->assertOk();

        $this->assertSame('last_month', $response->json('data.range.preset'));
        $this->assertSame('2026-02-01', $response->json('data.range.start'));
        $this->assertSame('2026-02-28', $response->json('data.range.end'));
        $this->assertSame('Last month', $response->json('data.range.label'));
    }

    public function test_quarter_preset_resolves_correctly(): void
    {
        Sanctum::actingAs($this->userWithRole('admin'));

        $response = $this->getJson('/api/admin/dashboard/sales?preset=quarter&quarter=2026-Q3')->assertOk();

        $this->assertSame('quarter', $response->json('data.range.preset'));
        $this->assertSame('2026-07-01', $response->json('data.range.start'));
        $this->assertSame('2026-09-30', $response->json('data.range.end'));
        $this->assertSame('Q3 2026', $response->json('data.range.label'));

        // Validation failures
        $this->getJson('/api/admin/dashboard/sales?preset=quarter')
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['quarter']);

        $this->getJson('/api/admin/dashboard/sales?preset=quarter&quarter=2026-Q5')
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['quarter']);
    }

    public function test_custom_preset_validation(): void
    {
        Sanctum::actingAs($this->userWithRole('admin'));

        // Missing dates
        $this->getJson('/api/admin/dashboard/sales?preset=custom')
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['start_date', 'end_date']);

        // start_date after end_date
        $this->getJson('/api/admin/dashboard/sales?preset=custom&start_date=2026-09-20&end_date=2026-09-10')
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['end_date']);

        // Valid custom range
        $response = $this->getJson('/api/admin/dashboard/sales?preset=custom&start_date=2026-09-10&end_date=2026-09-20')
            ->assertOk();

        $this->assertSame('custom', $response->json('data.range.preset'));
        $this->assertSame('2026-09-10', $response->json('data.range.start'));
        $this->assertSame('2026-09-20', $response->json('data.range.end'));
        $this->assertSame('Custom', $response->json('data.range.label'));
    }

    public function test_comparison_previous_year_match_day(): void
    {
        Sanctum::actingAs($this->userWithRole('admin'));

        Carbon::setTestNow('2026-09-14 12:00:00');

        // Primary: last_7_days -> [2026-09-08 (Tue), 2026-09-14 (Mon)] (7 days)
        // Compare previous_year_match_day: 364 days back
        // 2026-09-08 - 364 days = 2025-09-09 (Tue)
        // 2026-09-14 - 364 days = 2025-09-15 (Mon)

        // Seed order in compare window ($100)
        Order::factory()->create([
            'status' => 'delivered',
            'total' => 10000,
            'created_at' => Carbon::parse('2025-09-10 12:00:00'),
        ]);

        // Seed order in primary window ($150)
        Order::factory()->create([
            'status' => 'delivered',
            'total' => 15000,
            'created_at' => Carbon::parse('2026-09-10 12:00:00'),
        ]);

        $response = $this->getJson('/api/admin/dashboard/sales?preset=last_7_days&comparison=previous_year_match_day')
            ->assertOk();

        $this->assertTrue($response->json('data.range.comparison_active'));
        $this->assertEquals(150.0, $response->json('data.stats.sales.decimal'));
        // (150 - 100) / 100 * 100 = +50.0%
        $this->assertEquals(50.0, $response->json('data.stats.sales.trend'));
        $this->assertSame(1, $response->json('data.stats.orders.count'));
        // 1 vs 1 = 0.0% trend
        $this->assertEquals(0.0, $response->json('data.stats.orders.trend'));
    }

    public function test_comparison_yesterday_rejected_when_primary_span_greater_than_one_day(): void
    {
        Sanctum::actingAs($this->userWithRole('admin'));

        $this->getJson('/api/admin/dashboard/sales?preset=last_30_days&comparison=yesterday')
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['comparison']);
    }

    public function test_comparison_yesterday_allowed_when_primary_is_single_day(): void
    {
        Sanctum::actingAs($this->userWithRole('admin'));

        Carbon::setTestNow('2026-09-14 12:00:00');

        // Seed order yesterday ($100)
        Order::factory()->create([
            'status' => 'delivered',
            'total' => 10000,
            'created_at' => Carbon::parse('2026-09-13 12:00:00'),
        ]);

        // Seed order today ($120)
        Order::factory()->create([
            'status' => 'delivered',
            'total' => 12000,
            'created_at' => Carbon::parse('2026-09-14 10:00:00'),
        ]);

        $response = $this->getJson('/api/admin/dashboard/sales?preset=today&comparison=yesterday')
            ->assertOk();

        $this->assertTrue($response->json('data.range.comparison_active'));
        $this->assertEquals(120.0, $response->json('data.stats.sales.decimal'));
        // (120 - 100) / 100 * 100 = +20.0%
        $this->assertEquals(20.0, $response->json('data.stats.sales.trend'));
    }

    public function test_returns_summary_refund_trend_is_unaffected_by_comparison_param(): void
    {
        Sanctum::actingAs($this->userWithRole('admin'));

        Carbon::setTestNow('2026-09-14 12:00:00');

        // Primary: last_7_days -> Sep 8 - Sep 14
        // Equal preceding period: Sep 1 - Sep 7
        // Previous year: Sep 2025

        // Primary: 10 orders, 1 refund
        for ($i = 0; $i < 10; $i++) {
            Order::factory()->create([
                'status' => 'delivered',
                'created_at' => Carbon::parse('2026-09-10 10:00:00'),
            ]);
        }
        OrderReturnRequest::create([
            'order_id' => Order::first()->id,
            'status' => OrderReturnRequest::STATUS_APPROVED,
            'requested_at' => Carbon::parse('2026-09-10 10:00:00'),
        ]);

        // Preceding period: 10 orders, 2 refunds
        for ($i = 0; $i < 10; $i++) {
            Order::factory()->create([
                'status' => 'delivered',
                'created_at' => Carbon::parse('2026-09-03 10:00:00'),
            ]);
        }
        for ($i = 0; $i < 2; $i++) {
            OrderReturnRequest::create([
                'order_id' => Order::first()->id,
                'status' => OrderReturnRequest::STATUS_APPROVED,
                'requested_at' => Carbon::parse('2026-09-03 10:00:00'),
            ]);
        }

        // Previous year: 10 orders, 5 refunds
        for ($i = 0; $i < 10; $i++) {
            Order::factory()->create([
                'status' => 'delivered',
                'created_at' => Carbon::parse('2025-09-10 10:00:00'),
            ]);
        }
        for ($i = 0; $i < 5; $i++) {
            OrderReturnRequest::create([
                'order_id' => Order::first()->id,
                'status' => OrderReturnRequest::STATUS_APPROVED,
                'requested_at' => Carbon::parse('2025-09-10 10:00:00'),
            ]);
        }

        $resNone = $this->getJson('/api/admin/dashboard/sales?preset=last_7_days&comparison=none')->assertOk();
        $resPrevYear = $this->getJson('/api/admin/dashboard/sales?preset=last_7_days&comparison=previous_year')->assertOk();

        // The refund trend must be identical regardless of comparison=none vs comparison=previous_year
        $this->assertSame(
            $resNone->json('data.returns_summary.refund_trend'),
            $resPrevYear->json('data.returns_summary.refund_trend')
        );
        $this->assertSame(
            $resNone->json('data.returns_summary.refund_rate'),
            $resPrevYear->json('data.returns_summary.refund_rate')
        );
    }

    public function test_legacy_range_behavior_remains_intact_when_preset_is_absent(): void
    {
        Sanctum::actingAs($this->userWithRole('admin'));

        $response = $this->getJson('/api/admin/dashboard/sales?range=30')->assertOk();

        // data.range must be plain string '30' (not an object) in legacy mode
        $this->assertSame('30', $response->json('data.range'));
        $this->assertArrayHasKey('sales', $response->json('data.stats'));
        $this->assertArrayHasKey('orders', $response->json('data.stats'));
        $this->assertArrayHasKey('aov', $response->json('data.stats'));
    }

    public function test_sales_over_time_omits_compare_series_when_comparison_inactive(): void
    {
        Sanctum::actingAs($this->userWithRole('admin'));

        Carbon::setTestNow('2026-09-14 12:00:00');

        // Case A: No comparison parameter
        $resNoParam = $this->getJson('/api/admin/dashboard/sales?preset=last_7_days')->assertOk();
        $seriesNoParam = $resNoParam->json('data.sales_over_time.series');
        $this->assertArrayHasKey('revenue', $seriesNoParam);
        $this->assertArrayHasKey('orders', $seriesNoParam);
        $this->assertArrayNotHasKey('revenue_compare', $seriesNoParam);
        $this->assertArrayNotHasKey('orders_compare', $seriesNoParam);

        // Case B: comparison=none
        $resNone = $this->getJson('/api/admin/dashboard/sales?preset=last_7_days&comparison=none')->assertOk();
        $seriesNone = $resNone->json('data.sales_over_time.series');
        $this->assertArrayHasKey('revenue', $seriesNone);
        $this->assertArrayHasKey('orders', $seriesNone);
        $this->assertArrayNotHasKey('revenue_compare', $seriesNone);
        $this->assertArrayNotHasKey('orders_compare', $seriesNone);
    }

    public function test_sales_over_time_includes_matching_length_compare_series_for_daily_granularity(): void
    {
        Sanctum::actingAs($this->userWithRole('admin'));

        Carbon::setTestNow('2026-09-14 12:00:00');

        $response = $this->getJson('/api/admin/dashboard/sales?preset=last_7_days&comparison=previous_year_match_day')->assertOk();
        $series = $response->json('data.sales_over_time.series');

        $this->assertArrayHasKey('revenue_compare', $series);
        $this->assertArrayHasKey('orders_compare', $series);
        $this->assertCount(7, $series['revenue']);
        $this->assertCount(7, $series['orders']);
        $this->assertCount(7, $series['revenue_compare']);
        $this->assertCount(7, $series['orders_compare']);
    }

    public function test_sales_over_time_compare_series_reflects_order_at_known_compare_index(): void
    {
        Sanctum::actingAs($this->userWithRole('admin'));

        Carbon::setTestNow('2026-09-14 12:00:00');

        // Primary last_7_days runs from 2026-09-08 (index 0) to 2026-09-14 (index 6).
        // comparison=previous_year_match_day starts 364 days earlier: 2025-09-09 (index 0).
        // Day index 2 in compare window is 2025-09-11 (matching primary day index 2: 2026-09-10).
        Order::factory()->create([
            'status' => 'delivered',
            'total' => 8550, // $85.50
            'created_at' => Carbon::parse('2025-09-11 14:00:00'),
        ]);

        // Primary order at index 0 (2026-09-08)
        Order::factory()->create([
            'status' => 'delivered',
            'total' => 12000, // $120.00
            'created_at' => Carbon::parse('2026-09-08 10:00:00'),
        ]);

        $response = $this->getJson('/api/admin/dashboard/sales?preset=last_7_days&comparison=previous_year_match_day')->assertOk();
        $series = $response->json('data.sales_over_time.series');

        // Primary assertions
        $this->assertSame(120.0, (float) $series['revenue'][0]);
        $this->assertSame(1, $series['orders'][0]);
        $this->assertSame(0.0, (float) $series['revenue'][2]);
        $this->assertSame(0, $series['orders'][2]);

        // Compare assertions: index 2 should have 85.50 and 1 order, all others 0
        $this->assertSame(0.0, (float) $series['revenue_compare'][0]);
        $this->assertSame(0, $series['orders_compare'][0]);
        $this->assertSame(85.5, (float) $series['revenue_compare'][2]);
        $this->assertSame(1, $series['orders_compare'][2]);
        $this->assertEquals([0.0, 0.0, 85.5, 0.0, 0.0, 0.0, 0.0], array_map('floatval', $series['revenue_compare']));
        $this->assertSame([0, 0, 1, 0, 0, 0, 0], $series['orders_compare']);
    }

    public function test_sales_over_time_monthly_granularity_matches_bucket_count_across_leap_year(): void
    {
        Sanctum::actingAs($this->userWithRole('admin'));

        // Primary: Feb 1, 2024 to May 15, 2024 (105 days > 90 days, leap year 2024)
        // Compare (previous_year): Feb 1, 2023 to May 15, 2023 (non-leap year 2023)
        // Calendar days differ (105 vs 104 days), but month buckets must strictly match (4 buckets).
        $response = $this->getJson('/api/admin/dashboard/sales?' . http_build_query([
            'preset' => 'custom',
            'start_date' => '2024-02-01',
            'end_date' => '2024-05-15',
            'comparison' => 'previous_year',
        ]))->assertOk();

        $this->assertSame('month', $response->json('data.sales_over_time.granularity'));

        $categories = $response->json('data.sales_over_time.categories');
        $series = $response->json('data.sales_over_time.series');

        // Feb, Mar, Apr, May -> 4 monthly buckets
        $this->assertCount(4, $categories);
        $this->assertCount(4, $series['revenue']);
        $this->assertCount(4, $series['orders']);
        $this->assertCount(4, $series['revenue_compare']);
        $this->assertCount(4, $series['orders_compare']);
        $this->assertSame(['Feb 2024', 'Mar 2024', 'Apr 2024', 'May 2024'], $categories);
    }

    private function userWithRole(string $role): User
    {
        $user = User::factory()->create();
        $user->assignRole($role);

        return $user;
    }
}
