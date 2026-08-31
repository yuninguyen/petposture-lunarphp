<?php

namespace Tests\Feature\Api\Admin;

use App\Lunar\DiscountTypes\FixedAmountOffPerUnit;
use App\Models\Discount;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Laravel\Sanctum\Sanctum;
use Lunar\DiscountTypes\AmountOff;
use Lunar\DiscountTypes\BuyXGetY;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class DiscountControllerTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        foreach (['super_admin', 'admin', 'staff', 'Product Manager', 'Order Manager', 'Support'] as $role) {
            Role::findOrCreate($role, 'web');
        }
    }

    public function test_core_admin_creates_lists_shows_updates_and_deletes_a_normalized_amount_off_discount(): void
    {
        $this->actingAsCoreAdmin();

        $created = $this->postJson('/api/admin/discounts', [
            'name' => 'Ten percent off',
            'coupon' => 'TEN-PERCENT',
            'type' => AmountOff::class,
            'starts_at' => '2026-08-31T12:00:00.000Z',
            'priority' => 5,
            'stop' => false,
            'data' => [
                'min_prices' => ['USD' => 25.00],
                'fixed_value' => false,
                'percentage' => 10.0,
            ],
        ])->assertCreated();

        $created->assertJsonPath('data.handle', 'ten-percent-off')
            ->assertJsonPath('data.supported', true)
            ->assertJsonPath('data.data.min_prices.USD', 25.0)
            ->assertJsonPath('data.data.percentage', 10.0);
        $this->assertSame(['id', 'name', 'handle', 'coupon', 'type', 'type_label', 'supported', 'status', 'starts_at', 'ends_at', 'uses', 'max_uses', 'max_uses_per_user', 'priority', 'stop', 'data', 'created_at', 'updated_at'], array_keys($created->json('data')));

        $id = $created->json('data.id');
        $this->getJson('/api/admin/discounts')->assertOk()->assertJsonPath('meta.per_page', 15);
        $this->getJson("/api/admin/discounts/{$id}")->assertOk();
        $this->putJson("/api/admin/discounts/{$id}", $this->amountOffPayload(['name' => 'Renamed', 'handle' => 'manual-handle']))->assertOk()->assertJsonPath('data.handle', 'manual-handle');
        $this->deleteJson("/api/admin/discounts/{$id}")->assertNoContent();
        $this->assertDatabaseMissing('lunar_discounts', ['id' => $id]);
    }

    public function test_mutation_requires_a_nonblank_unique_coupon_and_only_supports_amount_off(): void
    {
        $this->actingAsCoreAdmin();

        $this->postJson('/api/admin/discounts', $this->amountOffPayload(['coupon' => '']))
            ->assertUnprocessable()->assertJsonValidationErrors('coupon');
        $this->postJson('/api/admin/discounts', $this->amountOffPayload(['type' => FixedAmountOffPerUnit::class]))
            ->assertUnprocessable()->assertJsonValidationErrors('type');
        $this->postJson('/api/admin/discounts', $this->amountOffPayload(['type' => BuyXGetY::class]))
            ->assertUnprocessable()->assertJsonValidationErrors('type');

        $this->postJson('/api/admin/discounts', $this->amountOffPayload())->assertCreated();
        $this->postJson('/api/admin/discounts', $this->amountOffPayload(['handle' => 'duplicate-coupon']))
            ->assertUnprocessable()->assertJsonValidationErrors('coupon');
    }

    public function test_amount_off_rejects_percentage_above_one_hundred_and_zero_use_limits(): void
    {
        $this->actingAsCoreAdmin();

        $this->postJson('/api/admin/discounts', $this->amountOffPayload([
            'data' => ['min_prices' => ['USD' => 0], 'fixed_value' => false, 'percentage' => 100.01],
        ]))->assertUnprocessable()->assertJsonValidationErrors('data.percentage');
        $this->postJson('/api/admin/discounts', $this->amountOffPayload(['max_uses' => 0]))
            ->assertUnprocessable()->assertJsonValidationErrors('max_uses');
        $this->postJson('/api/admin/discounts', $this->amountOffPayload(['max_uses_per_user' => 0]))
            ->assertUnprocessable()->assertJsonValidationErrors('max_uses_per_user');
    }

    public function test_money_is_converted_between_decimal_api_values_and_lunar_minor_units(): void
    {
        $this->actingAsCoreAdmin();

        $response = $this->postJson('/api/admin/discounts', $this->amountOffPayload([
            'data' => ['min_prices' => ['USD' => 12.50], 'fixed_value' => true, 'fixed_values' => ['USD' => 3.25]],
        ]))->assertCreated();

        $discount = Discount::findOrFail($response->json('data.id'));
        $this->assertSame(1250, $discount->data['min_prices']['USD']);
        $this->assertSame(325, $discount->data['fixed_values']['USD']);
        $response->assertJsonPath('data.data.fixed_values.USD', 3.25);
    }

    public function test_valid_amount_off_preserves_active_data_only(): void
    {
        $this->actingAsCoreAdmin();

        $response = $this->postJson('/api/admin/discounts', $this->amountOffPayload([
            'data' => ['min_prices' => ['USD' => 1], 'fixed_value' => false, 'percentage' => 25, 'fixed_values' => ['USD' => 2]],
        ]))->assertCreated()->assertJsonPath('data.supported', true)->assertJsonPath('data.type_label', 'Amount off');

        $this->assertSame(['min_prices' => ['USD' => 1.0], 'fixed_value' => false, 'percentage' => 25.0], $response->json('data.data'));
    }

    public function test_validation_auto_handle_uniqueness_and_time_ordering_are_enforced(): void
    {
        $this->actingAsCoreAdmin();
        $first = $this->postJson('/api/admin/discounts', $this->amountOffPayload(['handle' => 'unique-handle', 'coupon' => 'UNIQUE']))->assertCreated();

        $this->postJson('/api/admin/discounts', [
            'name' => '', 'handle' => 'unique-handle', 'coupon' => 'UNIQUE', 'type' => AmountOff::class,
            'starts_at' => '2026-08-31T12:00:00.000Z', 'ends_at' => '2026-08-31T11:00:00.000Z',
            'max_uses' => -1, 'max_uses_per_user' => -1, 'priority' => 'not-an-integer', 'stop' => 'not-a-boolean',
            'data' => ['min_prices' => ['USD' => -1]],
        ])->assertUnprocessable()->assertJsonValidationErrors(['name', 'handle', 'coupon', 'ends_at', 'max_uses', 'max_uses_per_user', 'priority', 'stop', 'data.min_prices.USD']);

        $this->putJson('/api/admin/discounts/'.$first->json('data.id'), $this->amountOffPayload(['name' => 'Different name', 'handle' => 'unique-handle', 'coupon' => 'UNIQUE']))
            ->assertOk()->assertJsonPath('data.handle', 'unique-handle');
    }

    public function test_legacy_unknown_discount_is_safe_to_list_show_and_delete_but_cannot_update(): void
    {
        $this->actingAsCoreAdmin();
        $legacy = Discount::query()->create([
            'name' => 'Legacy per unit',
            'handle' => 'legacy-per-unit',
            'coupon' => 'LEGACY',
            'type' => FixedAmountOffPerUnit::class,
            'starts_at' => now()->subMinute(),
            'data' => ['min_prices' => ['USD' => 1200], 'fixed_value' => true, 'fixed_values' => ['USD' => 250]],
        ]);

        $this->getJson('/api/admin/discounts')->assertOk()
            ->assertJsonPath('data.0.id', $legacy->id)
            ->assertJsonPath('data.0.supported', false)
            ->assertJsonPath('data.0.type_label', 'Unsupported')
            ->assertJsonPath('data.0.data.min_prices.USD', 12.0);
        $this->getJson("/api/admin/discounts/{$legacy->id}")->assertOk()
            ->assertJsonPath('data.supported', false)
            ->assertJsonPath('data.type_label', 'Unsupported')
            ->assertJsonPath('data.data.min_prices.USD', 12.0);
        $this->putJson("/api/admin/discounts/{$legacy->id}", $this->amountOffPayload(['name' => 'Mutated legacy']))
            ->assertUnprocessable()->assertJsonValidationErrors('type');
        $this->assertSame('Legacy per unit', $legacy->refresh()->name);
        $this->deleteJson("/api/admin/discounts/{$legacy->id}")->assertNoContent();
    }

    public function test_all_core_roles_can_list_and_non_core_roles_are_forbidden_from_every_endpoint(): void
    {
        foreach (['super_admin', 'admin', 'staff'] as $role) {
            Sanctum::actingAs($this->userWithRole($role));
            $this->getJson('/api/admin/discounts')->assertOk();
        }

        $discount = Discount::query()->create($this->discountAttributes());
        $requests = [
            fn () => $this->getJson('/api/admin/discounts'),
            fn () => $this->postJson('/api/admin/discounts', $this->amountOffPayload()),
            fn () => $this->getJson("/api/admin/discounts/{$discount->id}"),
            fn () => $this->putJson("/api/admin/discounts/{$discount->id}", $this->amountOffPayload()),
            fn () => $this->patchJson("/api/admin/discounts/{$discount->id}", $this->amountOffPayload()),
            fn () => $this->deleteJson("/api/admin/discounts/{$discount->id}"),
        ];

        foreach (['Product Manager', 'Order Manager', 'Support'] as $role) {
            Sanctum::actingAs($this->userWithRole($role));
            foreach ($requests as $request) {
                $request()->assertForbidden();
            }
        }
    }

    public function test_lunar_statuses_pagination_and_grouped_name_or_coupon_search_are_exposed(): void
    {
        Carbon::setTestNow('2026-08-31 12:00:00 UTC');
        $this->actingAsCoreAdmin();

        $statuses = [
            'active' => ['starts_at' => now()->subMinute(), 'ends_at' => null],
            'expired' => ['starts_at' => now()->subDay(), 'ends_at' => now()->subSecond()],
            'pending' => ['starts_at' => now(), 'ends_at' => null],
            'scheduled' => ['starts_at' => now()->addMinute(), 'ends_at' => null],
        ];
        foreach ($statuses as $name => $times) {
            $response = $this->postJson('/api/admin/discounts', $this->amountOffPayload(['name' => $name, 'handle' => $name, 'coupon' => strtoupper($name), ...$times]))->assertCreated();
            $response->assertJsonPath('data.status', $name);
        }

        for ($number = 1; $number <= 16; $number++) {
            Carbon::setTestNow(Carbon::parse('2026-08-31 12:00:00 UTC')->addSeconds($number));
            $this->postJson('/api/admin/discounts', $this->amountOffPayload(['name' => "Discount {$number}", 'handle' => "discount-{$number}", 'coupon' => $number === 1 ? 'MATCH-COUPON' : "COUPON-{$number}"]))->assertCreated();
        }

        Carbon::setTestNow('2026-08-31 12:01:00 UTC');
        $this->postJson('/api/admin/discounts', $this->amountOffPayload(['name' => 'Matching name', 'handle' => 'matching-name']))->assertCreated();
        $this->getJson('/api/admin/discounts?search=MATCH-COUPON')->assertOk()->assertJsonCount(1, 'data');
        $this->getJson('/api/admin/discounts?search=Matching%20name')->assertOk()->assertJsonCount(1, 'data');
        $this->getJson('/api/admin/discounts?search=unmatched')->assertOk()->assertJsonCount(0, 'data');
        $page = $this->getJson('/api/admin/discounts?page=2')->assertOk()->assertJsonPath('meta.per_page', 15)->assertJsonPath('meta.current_page', 2);
        $this->assertSame('Discount 2', $page->json('data.0.name'));

        Carbon::setTestNow();
    }

    private function amountOffPayload(array $overrides = []): array
    {
        return [...[
            'name' => 'Amount off', 'handle' => 'amount-off', 'coupon' => 'AMOUNT-OFF', 'type' => AmountOff::class,
            'starts_at' => '2026-08-31T12:00:00.000Z', 'ends_at' => null, 'priority' => 1, 'stop' => false,
            'max_uses' => null, 'max_uses_per_user' => null,
            'data' => ['min_prices' => ['USD' => 0], 'fixed_value' => false, 'percentage' => 10],
        ], ...$overrides];
    }

    private function discountAttributes(): array
    {
        return [
            'name' => 'Existing', 'handle' => 'existing', 'type' => AmountOff::class, 'starts_at' => now()->subMinute(),
            'uses' => 0, 'data' => ['min_prices' => ['USD' => 0], 'fixed_value' => false, 'percentage' => 10],
        ];
    }

    private function actingAsCoreAdmin(): User
    {
        $user = $this->userWithRole('admin');
        Sanctum::actingAs($user);

        return $user;
    }

    private function userWithRole(string $role): User
    {
        $user = User::factory()->create();
        $user->assignRole($role);

        return $user;
    }
}
