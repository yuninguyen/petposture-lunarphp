<?php

namespace Tests\Feature\Api\Admin;

use App\Lunar\DiscountTypes\FixedAmountOffPerUnit;
use App\Models\Discount;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Lunar\Base\DiscountManagerInterface;
use Lunar\DiscountTypes\AmountOff;
use Lunar\DiscountTypes\BuyXGetY;
use Lunar\FieldTypes\Text;
use Lunar\Models\Cart;
use Lunar\Models\Channel;
use Lunar\Models\Collection as LunarCollection;
use Lunar\Models\CollectionGroup;
use Lunar\Models\Currency;
use Lunar\Models\CustomerGroup;
use Lunar\Models\Language;
use Lunar\Models\Price;
use Lunar\Models\Product as LunarProduct;
use Lunar\Models\ProductType;
use Lunar\Models\ProductVariant;
use Lunar\Models\TaxClass;
use Lunar\Models\TaxZone;
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
        $this->assertSame(['id', 'name', 'handle', 'coupon', 'type', 'type_label', 'supported', 'status', 'starts_at', 'ends_at', 'uses', 'max_uses', 'max_uses_per_user', 'priority', 'stop', 'data', 'applies_to', 'collection_ids', 'collections', 'product_ids', 'products', 'created_at', 'updated_at'], array_keys($created->json('data')));

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
    }

    public function test_creates_discount_with_applies_to_all_products_persists_no_limitation_rows(): void
    {
        $this->actingAsCoreAdmin();

        $response = $this->postJson('/api/admin/discounts', $this->amountOffPayload([
            'coupon' => 'ALLPROD',
            'applies_to' => 'all_products',
        ]))->assertCreated();

        $response->assertJsonPath('data.applies_to', 'all_products')
            ->assertJsonPath('data.collection_ids', [])
            ->assertJsonPath('data.product_ids', []);

        $discount = Discount::findOrFail($response->json('data.id'));
        $this->assertSame(0, $discount->collections()->wherePivot('type', 'limitation')->count());
        $this->assertSame(0, $discount->discountableLimitations()->count());
    }

    public function test_creates_discount_with_applies_to_specific_collections_persists_limitation_rows(): void
    {
        $this->actingAsCoreAdmin();
        $collection = $this->createCollection('Dog Posture Harnesses');

        $response = $this->postJson('/api/admin/discounts', $this->amountOffPayload([
            'coupon' => 'HARNESS20',
            'applies_to' => 'specific_collections',
            'collection_ids' => [$collection->id],
        ]))->assertCreated();

        $response->assertJsonPath('data.applies_to', 'specific_collections')
            ->assertJsonPath('data.collection_ids', [$collection->id])
            ->assertJsonPath('data.collections.0.id', $collection->id)
            ->assertJsonPath('data.collections.0.name', 'Dog Posture Harnesses');

        $discount = Discount::findOrFail($response->json('data.id'));
        $this->assertSame([$collection->id], $discount->collections()->wherePivot('type', 'limitation')->pluck('lunar_collections.id')->all());
        $this->assertSame(0, $discount->discountableLimitations()->count());
    }

    public function test_creates_discount_with_applies_to_specific_products_persists_limitation_rows(): void
    {
        $this->actingAsCoreAdmin();
        $variant = $this->createProductWithVariant();
        $product = $variant->product;

        $response = $this->postJson('/api/admin/discounts', $this->amountOffPayload([
            'coupon' => 'SPECIFICPROD',
            'applies_to' => 'specific_products',
            'product_ids' => [$product->id],
        ]))->assertCreated();

        $response->assertJsonPath('data.applies_to', 'specific_products')
            ->assertJsonPath('data.product_ids', [$product->id])
            ->assertJsonPath('data.products.0.id', $product->id);

        $discount = Discount::findOrFail($response->json('data.id'));
        $this->assertSame(1, $discount->discountableLimitations()->count());
        $this->assertSame($product->id, $discount->discountableLimitations()->first()->discountable_id);
        $this->assertSame(0, $discount->collections()->wherePivot('type', 'limitation')->count());
    }

    public function test_updating_from_specific_collections_to_all_products_clears_all_limitation_rows(): void
    {
        $this->actingAsCoreAdmin();
        $collection = $this->createCollection('Temporary Collection');

        $created = $this->postJson('/api/admin/discounts', $this->amountOffPayload([
            'coupon' => 'CLEARLIMITS',
            'applies_to' => 'specific_collections',
            'collection_ids' => [$collection->id],
        ]))->assertCreated();

        $id = $created->json('data.id');
        $discount = Discount::findOrFail($id);
        $this->assertSame(1, $discount->collections()->wherePivot('type', 'limitation')->count());

        $updated = $this->putJson("/api/admin/discounts/{$id}", $this->amountOffPayload([
            'coupon' => 'CLEARLIMITS',
            'applies_to' => 'all_products',
            'collection_ids' => [],
        ]))->assertOk();

        $updated->assertJsonPath('data.applies_to', 'all_products')
            ->assertJsonPath('data.collection_ids', [])
            ->assertJsonPath('data.product_ids', []);

        $discount->refresh();
        $this->assertSame(0, $discount->collections()->wherePivot('type', 'limitation')->count());
        $this->assertSame(0, $discount->discountableLimitations()->count());
    }

    public function test_validation_rejects_missing_or_invalid_collection_and_product_ids(): void
    {
        $this->actingAsCoreAdmin();

        $this->postJson('/api/admin/discounts', $this->amountOffPayload([
            'coupon' => 'ERR1',
            'applies_to' => 'specific_collections',
            'collection_ids' => [],
        ]))->assertUnprocessable()->assertJsonValidationErrors('collection_ids');

        $this->postJson('/api/admin/discounts', $this->amountOffPayload([
            'coupon' => 'ERR2',
            'applies_to' => 'specific_collections',
            'collection_ids' => [999999],
        ]))->assertUnprocessable()->assertJsonValidationErrors('collection_ids.0');

        $this->postJson('/api/admin/discounts', $this->amountOffPayload([
            'coupon' => 'ERR3',
            'applies_to' => 'specific_products',
            'product_ids' => [],
        ]))->assertUnprocessable()->assertJsonValidationErrors('product_ids');

        $this->postJson('/api/admin/discounts', $this->amountOffPayload([
            'coupon' => 'ERR4',
            'applies_to' => 'specific_products',
            'product_ids' => [999999],
        ]))->assertUnprocessable()->assertJsonValidationErrors('product_ids.0');

        $this->postJson('/api/admin/discounts', $this->amountOffPayload([
            'coupon' => 'ERR5',
            'applies_to' => 'invalid_scope',
        ]))->assertUnprocessable()->assertJsonValidationErrors('applies_to');
    }

    public function test_cart_apply_with_scoped_discount_discounts_only_in_scope_product(): void
    {
        $this->setUpLunarPrerequisites();

        $collection = $this->createCollection('Harnesses');

        // Product A in collection: price 10000 minor ($100.00)
        $variantA = $this->createProductWithVariant(10000, $collection);

        // Product B NOT in collection: price 5000 minor ($50.00)
        $variantB = $this->createProductWithVariant(5000, null);

        // Admin creates 10% discount on collection
        $this->actingAsCoreAdmin();
        $this->postJson('/api/admin/discounts', $this->amountOffPayload([
            'name' => '10% off Harnesses',
            'coupon' => 'HARNESS10',
            'applies_to' => 'specific_collections',
            'collection_ids' => [$collection->id],
            'data' => [
                'min_prices' => ['USD' => 0],
                'fixed_value' => false,
                'percentage' => 10,
            ],
        ]))->assertCreated();

        // Create Cart and add both items
        $currency = Currency::getDefault();
        $channel = Channel::getDefault();

        $cart = Cart::create([
            'currency_id' => $currency->id,
            'channel_id' => $channel->id,
        ]);

        $cart->add($variantA, 1);
        $cart->add($variantB, 1);

        $cart->coupon_code = 'HARNESS10';
        $cart->discounts = collect();
        $cart->discountBreakdown = collect();

        $cart = app(DiscountManagerInterface::class)
            ->resetDiscounts()
            ->apply($cart);

        // Cart::add()'s returned line's `id` is not reliable immediately after
        // the call (both additions reported id=1 during debugging even though
        // the persisted rows were correctly 1 and 2), so identify lines by
        // their purchasable (variant) id instead of a captured line id.
        $lineA = $cart->lines->firstWhere('purchasable_id', $variantA->id);
        $lineB = $cart->lines->firstWhere('purchasable_id', $variantB->id);

        // Line A (in collection) must be discounted by 10% (1000 minor = $10.00)
        $this->assertSame(1000, $lineA->discountTotal->value);
        $this->assertSame(9000, $lineA->subTotalDiscounted->value);

        // Line B (out of collection) must NOT be discounted: Lunar's cart pipeline
        // always populates subTotalDiscounted after totals are calculated (equal
        // to subTotal when nothing was discounted), so assert equality rather
        // than nullity.
        $this->assertSame(0, $lineB->discountTotal?->value ?? 0);
        $this->assertSame(5000, $lineB->subTotal->value);
        $this->assertSame(5000, $lineB->subTotalDiscounted->value);

        // Overall cart discount matches only in-scope product
        $this->assertSame(1000, $cart->lines->sum(fn ($l) => $l->discountTotal?->value ?? 0));
    }

    private function createCollection(string $name = 'Test Collection'): LunarCollection
    {
        $group = CollectionGroup::query()->firstOrCreate(['handle' => 'main'], ['name' => 'Main']);
        $collection = new LunarCollection([
            'collection_group_id' => $group->id,
            'attribute_data' => [
                'name' => new Text($name),
            ],
        ]);
        $collection->saveAsRoot();

        return $collection;
    }

    private function createProductWithVariant(int $priceMinor = 10000, ?LunarCollection $collection = null): ProductVariant
    {
        $this->setUpLunarPrerequisites();

        $productType = ProductType::firstOrCreate(['name' => 'General']);
        $taxClass = TaxClass::firstOrCreate(['name' => 'Default'], ['default' => true]);
        $channel = Channel::getDefault();
        $customerGroup = CustomerGroup::query()->where('default', true)->first();
        $currency = Currency::getDefault();

        $product = LunarProduct::create([
            'product_type_id' => $productType->id,
            'status' => 'published',
            'attribute_data' => [
                'name' => new Text('Test Product ' . Str::random(5)),
            ],
        ]);

        $product->channels()->syncWithPivotValues([$channel->id], [
            'enabled' => true,
            'starts_at' => now(),
        ], false);

        $product->customerGroups()->syncWithPivotValues([$customerGroup->id], [
            'enabled' => true,
            'starts_at' => now(),
        ], false);

        if ($collection) {
            $product->collections()->attach($collection->id);
        }

        $variant = ProductVariant::create([
            'product_id' => $product->id,
            'tax_class_id' => $taxClass->id,
            'sku' => 'SKU-' . Str::upper(Str::random(6)),
            'stock' => 50,
            'shippable' => true,
        ]);

        Price::create([
            'customer_group_id' => null,
            'currency_id' => $currency->id,
            'priceable_type' => $variant->getMorphClass(),
            'priceable_id' => $variant->id,
            'price' => $priceMinor,
            'min_quantity' => 1,
        ]);

        return $variant;
    }

    private function setUpLunarPrerequisites(): void
    {
        Language::firstOrCreate(
            ['code' => 'en'],
            ['name' => 'English', 'default' => true]
        );

        $currency = Currency::firstOrCreate(
            ['code' => 'USD'],
            [
                'name' => 'US Dollar',
                'decimal_places' => 2,
                'default' => true,
                'enabled' => true,
                'exchange_rate' => 1,
            ]
        );
        if (! $currency->default || ! $currency->enabled) {
            $currency->forceFill(['default' => true, 'enabled' => true])->save();
        }

        $channel = Channel::firstOrCreate(
            ['handle' => 'webstore'],
            [
                'name' => 'Webstore',
                'default' => true,
                'url' => 'http://localhost',
            ]
        );
        if (! $channel->default) {
            $channel->forceFill(['default' => true])->save();
        }

        CustomerGroup::firstOrCreate(
            ['handle' => 'default'],
            ['name' => 'Default', 'default' => true]
        );

        TaxZone::firstOrCreate(
            ['name' => 'Default Tax Zone'],
            ['zone_type' => 'country', 'price_display' => 'tax_exclusive', 'active' => true, 'default' => true]
        );
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
