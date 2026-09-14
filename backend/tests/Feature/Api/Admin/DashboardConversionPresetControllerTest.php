<?php

namespace Tests\Feature\Api\Admin;

use App\Models\CheckoutSession;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Lunar\Models\Cart;
use Lunar\Models\Channel;
use Lunar\Models\Currency;
use Lunar\Models\Order;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class DashboardConversionPresetControllerTest extends TestCase
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
            $response = $this->getJson("/api/admin/dashboard/conversion?preset={$preset}")->assertOk();

            $this->assertSame($preset, $response->json('data.range.preset'), "Preset {$preset} mismatch");
            $this->assertSame($expectedStart, $response->json('data.range.start'), "Preset {$preset} start mismatch");
            $this->assertSame($expectedEnd, $response->json('data.range.end'), "Preset {$preset} end mismatch");
            $this->assertSame($expectedLabel, $response->json('data.range.label'), "Preset {$preset} label mismatch");
            $this->assertArrayNotHasKey('comparison_active', $response->json('data.range'), "Preset {$preset} must not have comparison_active");
        }
    }

    public function test_last_month_around_month_end_edge_case(): void
    {
        Sanctum::actingAs($this->userWithRole('admin'));

        // Freeze on March 31, 2026 — testing subMonthNoOverflow does not roll into March
        Carbon::setTestNow('2026-03-31 15:00:00');

        $response = $this->getJson('/api/admin/dashboard/conversion?preset=last_month')->assertOk();

        $this->assertSame('last_month', $response->json('data.range.preset'));
        $this->assertSame('2026-02-01', $response->json('data.range.start'));
        $this->assertSame('2026-02-28', $response->json('data.range.end'));
        $this->assertSame('Last month', $response->json('data.range.label'));
    }

    public function test_quarter_preset_resolves_correctly(): void
    {
        Sanctum::actingAs($this->userWithRole('admin'));

        $response = $this->getJson('/api/admin/dashboard/conversion?preset=quarter&quarter=2026-Q3')->assertOk();

        $this->assertSame('quarter', $response->json('data.range.preset'));
        $this->assertSame('2026-07-01', $response->json('data.range.start'));
        $this->assertSame('2026-09-30', $response->json('data.range.end'));
        $this->assertSame('Q3 2026', $response->json('data.range.label'));
    }

    public function test_custom_preset_resolves_correctly(): void
    {
        Sanctum::actingAs($this->userWithRole('admin'));

        $response = $this->getJson('/api/admin/dashboard/conversion?preset=custom&start_date=2026-08-01&end_date=2026-08-15')->assertOk();

        $this->assertSame('custom', $response->json('data.range.preset'));
        $this->assertSame('2026-08-01', $response->json('data.range.start'));
        $this->assertSame('2026-08-15', $response->json('data.range.end'));
        $this->assertSame('Custom', $response->json('data.range.label'));
    }

    public function test_validation_rejects_invalid_presets_and_dates(): void
    {
        Sanctum::actingAs($this->userWithRole('admin'));

        // Invalid preset
        $this->getJson('/api/admin/dashboard/conversion?preset=not_a_preset')
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['preset']);

        // Quarter missing quarter param
        $this->getJson('/api/admin/dashboard/conversion?preset=quarter')
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['quarter']);

        // Invalid quarter format
        $this->getJson('/api/admin/dashboard/conversion?preset=quarter&quarter=2026-Q5')
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['quarter']);

        // Custom missing dates
        $this->getJson('/api/admin/dashboard/conversion?preset=custom')
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['start_date', 'end_date']);

        // Custom end date before start date
        $this->getJson('/api/admin/dashboard/conversion?preset=custom&start_date=2026-09-14&end_date=2026-09-01')
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['end_date']);
    }

    public function test_preset_mode_bounds_records_within_period_excluding_before_and_after(): void
    {
        Sanctum::actingAs($this->userWithRole('admin'));

        // Freeze time at Monday 2026-09-14 12:00:00
        Carbon::setTestNow('2026-09-14 12:00:00');

        $currency = Currency::getDefault();
        $channel = Channel::getDefault();

        // Preset: last_7_days => [2026-09-08 00:00:00, 2026-09-14 23:59:59]

        // 1. In-range records (2026-09-10)
        Cart::create([
            'currency_id' => $currency->id,
            'channel_id' => $channel->id,
            'created_at' => Carbon::parse('2026-09-10 10:00:00'),
        ]);
        $this->createCheckoutSession([
            'token' => Str::random(32),
            'status' => 'open',
            'created_at' => Carbon::parse('2026-09-10 10:05:00'),
        ]);
        Order::factory()->create([
            'status' => 'placed',
            'created_at' => Carbon::parse('2026-09-10 10:10:00'),
        ]);

        // 2. Before-range records (2026-09-01)
        Cart::create([
            'currency_id' => $currency->id,
            'channel_id' => $channel->id,
            'created_at' => Carbon::parse('2026-09-01 10:00:00'),
        ]);
        $this->createCheckoutSession([
            'token' => Str::random(32),
            'status' => 'open',
            'created_at' => Carbon::parse('2026-09-01 10:05:00'),
        ]);
        Order::factory()->create([
            'status' => 'placed',
            'created_at' => Carbon::parse('2026-09-01 10:10:00'),
        ]);

        // 3. After-range records (2026-09-20)
        Cart::create([
            'currency_id' => $currency->id,
            'channel_id' => $channel->id,
            'created_at' => Carbon::parse('2026-09-20 10:00:00'),
        ]);
        $this->createCheckoutSession([
            'token' => Str::random(32),
            'status' => 'open',
            'created_at' => Carbon::parse('2026-09-20 10:05:00'),
        ]);
        Order::factory()->create([
            'status' => 'placed',
            'created_at' => Carbon::parse('2026-09-20 10:10:00'),
        ]);

        $response = $this->getJson('/api/admin/dashboard/conversion?preset=last_7_days')->assertOk();

        // Exactly 1 in-range item each should be counted
        $this->assertSame(1, $response->json('data.carts_created'));
        $this->assertSame(1, $response->json('data.checkouts_started'));
        $this->assertSame(1, $response->json('data.orders_completed'));
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
