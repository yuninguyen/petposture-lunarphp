<?php

namespace Tests\Feature\Api\Admin;

use App\DiscountTypes\FreeShipping;
use App\Lunar\DiscountTypes\FixedAmountOffPerUnit;
use App\Models\Discount;
use App\Models\ShippingMethod;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Lunar\Base\DiscountManagerInterface;
use Lunar\Base\ShippingManifestInterface;
use Lunar\DiscountTypes\AmountOff;
use Lunar\DiscountTypes\BuyXGetY;
use Lunar\FieldTypes\Text;
use Lunar\Models\Cart;
use Lunar\Models\Channel;
use Lunar\Models\Collection as LunarCollection;
use Lunar\Models\CollectionGroup;
use Lunar\Models\Country;
use Lunar\Models\Currency;
use Lunar\Models\CustomerGroup;
use Lunar\Models\Language;
use Lunar\Models\Order;
use Lunar\Models\Price;
use Lunar\Models\Product as LunarProduct;
use Lunar\Models\ProductType;
use Lunar\Models\ProductVariant;
use Lunar\Models\TaxClass;
use Lunar\Models\TaxRate;
use Lunar\Models\TaxRateAmount;
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
        $this->assertSame(['id', 'name', 'handle', 'coupon', 'type', 'type_label', 'supported', 'status', 'starts_at', 'ends_at', 'uses', 'max_uses', 'max_uses_per_user', 'priority', 'stop', 'data', 'applies_to', 'collection_ids', 'collections', 'product_ids', 'products', 'condition_type', 'condition_collection_ids', 'condition_collections', 'condition_product_ids', 'condition_products', 'reward_product_ids', 'reward_products', 'created_at', 'updated_at'], array_keys($created->json('data')));

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
        $this->postJson('/api/admin/discounts', $this->amountOffPayload(['type' => 'App\\DiscountTypes\\UnsupportedType']))
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
        ]))->assertCreated()->assertJsonPath('data.supported', true)->assertJsonPath('data.type_label', 'Amount off order');

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
            ->assertJsonPath('data.type_label', 'Amount off order')
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
            ->assertJsonPath('data.type_label', 'Amount off products')
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
            ->assertJsonPath('data.type_label', 'Amount off products')
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
        $created->assertJsonPath('data.type_label', 'Amount off products');

        $id = $created->json('data.id');
        $discount = Discount::findOrFail($id);
        $this->assertSame(1, $discount->collections()->wherePivot('type', 'limitation')->count());

        $updated = $this->putJson("/api/admin/discounts/{$id}", $this->amountOffPayload([
            'coupon' => 'CLEARLIMITS',
            'applies_to' => 'all_products',
            'collection_ids' => [],
        ]))->assertOk();

        $updated->assertJsonPath('data.applies_to', 'all_products')
            ->assertJsonPath('data.type_label', 'Amount off order')
            ->assertJsonPath('data.collection_ids', [])
            ->assertJsonPath('data.product_ids', []);

        $discount->refresh();
        $this->assertSame(0, $discount->collections()->wherePivot('type', 'limitation')->count());
        $this->assertSame(0, $discount->discountableLimitations()->count());
    }

    public function test_type_label_differentiates_between_amount_off_order_and_amount_off_products(): void
    {
        $this->actingAsCoreAdmin();

        $orderDiscount = $this->postJson('/api/admin/discounts', $this->amountOffPayload([
            'name' => 'Storewide 10% Off',
            'handle' => 'storewide-10-off',
            'coupon' => 'ORDER10',
            'applies_to' => 'all_products',
        ]))->assertCreated();
        $orderDiscount->assertJsonPath('data.type_label', 'Amount off order');

        $collection = $this->createCollection('Bandanas');
        $collectionDiscount = $this->postJson('/api/admin/discounts', $this->amountOffPayload([
            'name' => '15% Off Bandanas',
            'handle' => 'bandanas-15-off',
            'coupon' => 'BANDANA15',
            'applies_to' => 'specific_collections',
            'collection_ids' => [$collection->id],
        ]))->assertCreated();
        $collectionDiscount->assertJsonPath('data.type_label', 'Amount off products');

        $variant = $this->createProductWithVariant();
        $productDiscount = $this->postJson('/api/admin/discounts', $this->amountOffPayload([
            'name' => '20% Off Harness',
            'handle' => 'harness-20-off',
            'coupon' => 'HARNESS20PROD',
            'applies_to' => 'specific_products',
            'product_ids' => [$variant->product->id],
        ]))->assertCreated();
        $productDiscount->assertJsonPath('data.type_label', 'Amount off products');

        $list = $this->getJson('/api/admin/discounts')->assertOk();
        $listItems = collect($list->json('data'));
        $this->assertSame('Amount off order', $listItems->firstWhere('coupon', 'ORDER10')['type_label'] ?? null);
        $this->assertSame('Amount off products', $listItems->firstWhere('coupon', 'BANDANA15')['type_label'] ?? null);
        $this->assertSame('Amount off products', $listItems->firstWhere('coupon', 'HARNESS20PROD')['type_label'] ?? null);
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

    public function test_core_admin_creates_lists_shows_updates_and_deletes_a_free_shipping_discount(): void
    {
        $this->actingAsCoreAdmin();

        $created = $this->postJson('/api/admin/discounts', [
            'name' => 'Free Shipping promo',
            'coupon' => 'FREESHIP',
            'type' => FreeShipping::class,
            'starts_at' => '2026-08-31T12:00:00.000Z',
            'priority' => 3,
            'stop' => false,
            'data' => [
                'min_prices' => ['USD' => 30.00],
            ],
        ])->assertCreated();

        $created->assertJsonPath('data.handle', 'free-shipping-promo')
            ->assertJsonPath('data.type', FreeShipping::class)
            ->assertJsonPath('data.type_label', 'Free shipping')
            ->assertJsonPath('data.supported', true)
            ->assertJsonPath('data.data.free_shipping', true)
            ->assertJsonPath('data.data.min_prices.USD', 30.0);

        $id = $created->json('data.id');
        $this->assertDatabaseHas('lunar_discounts', [
            'id' => $id,
            'type' => FreeShipping::class,
        ]);

        $this->getJson("/api/admin/discounts/{$id}")
            ->assertOk()
            ->assertJsonPath('data.type_label', 'Free shipping')
            ->assertJsonPath('data.data.free_shipping', true);

        $this->putJson("/api/admin/discounts/{$id}", [
            'name' => 'Updated Free Shipping',
            'handle' => 'updated-free-shipping',
            'coupon' => 'FREESHIP-2',
            'type' => FreeShipping::class,
            'starts_at' => '2026-08-31T12:00:00.000Z',
            'priority' => 4,
            'stop' => true,
            'data' => [
                'min_prices' => ['USD' => 0],
            ],
        ])->assertOk()
            ->assertJsonPath('data.handle', 'updated-free-shipping')
            ->assertJsonPath('data.coupon', 'FREESHIP-2')
            ->assertJsonPath('data.data.free_shipping', true);

        $this->deleteJson("/api/admin/discounts/{$id}")->assertNoContent();
        $this->assertDatabaseMissing('lunar_discounts', ['id' => $id]);
    }

    public function test_free_shipping_discount_zeroes_shipping_rates_in_checkout_flow(): void
    {
        $this->setUpLunarPrerequisites();

        // Ensure shipping methods exist with predictable rates
        ShippingMethod::query()->updateOrCreate(
            ['code' => 'standard'],
            ['name' => 'Standard Shipping', 'price' => 15.00, 'free_over' => 50.00]
        );
        ShippingMethod::query()->updateOrCreate(
            ['code' => 'express'],
            ['name' => 'Express Shipping', 'price' => 25.00, 'free_over' => null]
        );

        // Product priced at $30 (3000 cents) - below standard shipping free_over threshold of $50
        $variant = $this->createProductWithVariant(3000, null);

        // Admin creates Free Shipping discount via API
        $this->actingAsCoreAdmin();
        $this->postJson('/api/admin/discounts', [
            'name' => 'Free Express & Standard',
            'coupon' => 'SHIPZERO',
            'type' => FreeShipping::class,
            'starts_at' => '2026-08-31T12:00:00.000Z',
            'priority' => 1,
            'stop' => false,
            'data' => [
                'min_prices' => ['USD' => 0],
            ],
        ])->assertCreated();

        // 1. Verify /api/apply-coupon reports free_shipping = true
        $this->postJson('/api/apply-coupon', [
            'coupon_code' => 'SHIPZERO',
            'items' => [
                ['variantId' => $variant->id, 'quantity' => 1],
            ],
        ])->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('coupon.free_shipping', true)
            ->assertJsonPath('discount_amount', 0);

        // 2. Verify /api/checkout/shipping-rates returns 0 when coupon is provided
        // Without coupon: subtotal $30 < $50, so standard is 1500, express is 2500
        $ratesWithoutCoupon = $this->getJson('/api/checkout/shipping-rates?subtotal_minor=3000')->assertOk();
        $this->assertSame(1500, collect($ratesWithoutCoupon->json('rates'))->firstWhere('id', 'standard')['price_minor']);
        $this->assertSame(2500, collect($ratesWithoutCoupon->json('rates'))->firstWhere('id', 'express')['price_minor']);

        // With free shipping coupon: all rates must be 0
        $ratesWithCoupon = $this->getJson('/api/checkout/shipping-rates?subtotal_minor=3000&coupon_code=SHIPZERO')->assertOk();
        $this->assertSame(0, collect($ratesWithCoupon->json('rates'))->firstWhere('id', 'standard')['price_minor']);
        $this->assertSame(0, collect($ratesWithCoupon->json('rates'))->firstWhere('id', 'express')['price_minor']);

        // 3. Verify Lunar Cart & ShippingManifest modifier
        $cart = Cart::create([
            'currency_id' => Currency::getDefault()->id,
            'channel_id' => Channel::getDefault()->id,
        ]);
        $cart->add($variant, 1);
        $cart->coupon_code = 'SHIPZERO';
        $cart->calculate();

        $shippingManifest = app(ShippingManifestInterface::class);
        $manifestOptions = $shippingManifest->getOptions($cart);
        $this->assertNotEmpty($manifestOptions);
        foreach ($manifestOptions as $option) {
            $this->assertSame(0, $option->price->value);
        }

        // 4. Verify checkout flow /api/checkout/place-order
        // Order placed WITH coupon: express shipping is 0
        $orderResponse = $this->postJson('/api/checkout/place-order', [
            'items' => [
                ['variantId' => $variant->id, 'quantity' => 1],
            ],
            'shipping' => [
                'email' => 'freeship@petposture.com',
                'first_name' => 'Jane',
                'last_name' => 'Doe',
                'line_one' => '123 Congress Ave',
                'city' => 'Austin',
                'state' => 'TX',
                'postcode' => '78701',
                'country' => 'United States',
                'phone' => '5125550101',
            ],
            'billing_same_as_shipping' => true,
            'shipping_method' => 'express',
            'payment_method' => 'cod',
            'coupon_code' => 'SHIPZERO',
        ])->assertCreated();

        $orderWithCoupon = Order::findOrFail($orderResponse->json('order.id'));
        $this->assertSame(0, $orderWithCoupon->shipping_total->value);

        // Lunar's ShippingManifest is container-scoped and de-dupes addOption()
        // calls by identifier without ever clearing between getOptions() calls,
        // so the zero-priced options computed for the coupon order above would
        // otherwise leak into this second, uncoupled place-order call within the
        // same test process. A real HTTP request gets a fresh container each
        // time in production, so this reset only matters here.
        app(ShippingManifestInterface::class)->clearOptions();

        // Order placed WITHOUT coupon: express shipping is 2500 cents ($25.00)
        $orderResponseNoCoupon = $this->postJson('/api/checkout/place-order', [
            'items' => [
                ['variantId' => $variant->id, 'quantity' => 1],
            ],
            'shipping' => [
                'email' => 'standard@petposture.com',
                'first_name' => 'John',
                'last_name' => 'Smith',
                'line_one' => '456 Main St',
                'city' => 'Austin',
                'state' => 'TX',
                'postcode' => '78701',
                'country' => 'United States',
                'phone' => '5125550102',
            ],
            'billing_same_as_shipping' => true,
            'shipping_method' => 'express',
            'payment_method' => 'cod',
        ])->assertCreated();

        $orderWithoutCoupon = Order::findOrFail($orderResponseNoCoupon->json('order.id'));
        $this->assertSame(2500, $orderWithoutCoupon->shipping_total->value);
    }

    public function test_core_admin_creates_lists_shows_updates_and_deletes_a_buy_x_get_y_discount(): void
    {
        $this->setUpLunarPrerequisites();
        $this->actingAsCoreAdmin();

        $variantA = $this->createProductWithVariant(5000);
        $variantB = $this->createProductWithVariant(3000);
        $collection = $this->createCollection('Conditions Collection');

        $created = $this->postJson('/api/admin/discounts', [
            'name' => 'Buy 2 A Get 1 B',
            'coupon' => 'B2A-G1B',
            'type' => BuyXGetY::class,
            'starts_at' => '2026-08-31T12:00:00.000Z',
            'priority' => 5,
            'stop' => false,
            'condition_type' => 'specific_products',
            'condition_product_ids' => [$variantA->product->id],
            'reward_product_ids' => [$variantB->product->id],
            'data' => [
                'min_qty' => 2,
                'reward_qty' => 1,
                'max_reward_qty' => 3,
                'automatically_add_rewards' => false,
            ],
        ])->assertCreated();

        $created->assertJsonPath('data.handle', 'buy-2-a-get-1-b')
            ->assertJsonPath('data.type', BuyXGetY::class)
            ->assertJsonPath('data.type_label', 'Buy X get Y')
            ->assertJsonPath('data.supported', true)
            ->assertJsonPath('data.condition_type', 'specific_products')
            ->assertJsonPath('data.condition_product_ids.0', $variantA->product->id)
            ->assertJsonPath('data.reward_product_ids.0', $variantB->product->id)
            ->assertJsonPath('data.data.min_qty', 2)
            ->assertJsonPath('data.data.reward_qty', 1)
            ->assertJsonPath('data.data.max_reward_qty', 3);

        $id = $created->json('data.id');
        $this->assertDatabaseHas('lunar_discounts', [
            'id' => $id,
            'type' => BuyXGetY::class,
        ]);
        $this->assertDatabaseHas('lunar_discountables', [
            'discount_id' => $id,
            'type' => 'condition',
            'discountable_type' => (new LunarProduct)->getMorphClass(),
            'discountable_id' => $variantA->product->id,
        ]);
        $this->assertDatabaseHas('lunar_discountables', [
            'discount_id' => $id,
            'type' => 'reward',
            'discountable_type' => (new LunarProduct)->getMorphClass(),
            'discountable_id' => $variantB->product->id,
        ]);

        $this->getJson("/api/admin/discounts/{$id}")
            ->assertOk()
            ->assertJsonPath('data.type_label', 'Buy X get Y')
            ->assertJsonPath('data.condition_products.0.id', $variantA->product->id)
            ->assertJsonPath('data.reward_products.0.id', $variantB->product->id);

        // Update to collection condition
        $this->putJson("/api/admin/discounts/{$id}", [
            'name' => 'Buy 3 in Collection Get 1 B',
            'handle' => 'buy-3-col-get-1-b',
            'coupon' => 'B3COL-G1B',
            'type' => BuyXGetY::class,
            'starts_at' => '2026-08-31T12:00:00.000Z',
            'condition_type' => 'specific_collections',
            'condition_collection_ids' => [$collection->id],
            'reward_product_ids' => [$variantB->product->id],
            'data' => [
                'min_qty' => 3,
                'reward_qty' => 1,
            ],
        ])->assertOk()
            ->assertJsonPath('data.handle', 'buy-3-col-get-1-b')
            ->assertJsonPath('data.condition_type', 'specific_collections')
            ->assertJsonPath('data.condition_collection_ids.0', $collection->id)
            ->assertJsonPath('data.data.min_qty', 3);

        $this->assertDatabaseMissing('lunar_discountables', [
            'discount_id' => $id,
            'type' => 'condition',
            'discountable_type' => (new LunarProduct)->getMorphClass(),
            'discountable_id' => $variantA->product->id,
        ]);
        $this->assertDatabaseHas('lunar_discountables', [
            'discount_id' => $id,
            'type' => 'condition',
            'discountable_type' => (new LunarCollection)->getMorphClass(),
            'discountable_id' => $collection->id,
        ]);

        $this->deleteJson("/api/admin/discounts/{$id}")->assertNoContent();
        $this->assertDatabaseMissing('lunar_discounts', ['id' => $id]);
        $this->assertDatabaseMissing('lunar_discountables', ['discount_id' => $id]);
    }

    public function test_buy_x_get_y_validation_requires_positive_quantities_and_scoped_items(): void
    {
        $this->setUpLunarPrerequisites();
        $this->actingAsCoreAdmin();

        $variantA = $this->createProductWithVariant(5000);
        $variantB = $this->createProductWithVariant(3000);

        // Missing min_qty
        $this->postJson('/api/admin/discounts', [
            'name' => 'Invalid min_qty',
            'coupon' => 'ERR-QTY-1',
            'type' => BuyXGetY::class,
            'starts_at' => '2026-08-31T12:00:00.000Z',
            'condition_type' => 'specific_products',
            'condition_product_ids' => [$variantA->product->id],
            'reward_product_ids' => [$variantB->product->id],
            'data' => ['reward_qty' => 1],
        ])->assertUnprocessable()->assertJsonValidationErrors('data.min_qty');

        // min_qty < 1
        $this->postJson('/api/admin/discounts', [
            'name' => 'Zero min_qty',
            'coupon' => 'ERR-QTY-0',
            'type' => BuyXGetY::class,
            'starts_at' => '2026-08-31T12:00:00.000Z',
            'condition_type' => 'specific_products',
            'condition_product_ids' => [$variantA->product->id],
            'reward_product_ids' => [$variantB->product->id],
            'data' => ['min_qty' => 0, 'reward_qty' => 1],
        ])->assertUnprocessable()->assertJsonValidationErrors('data.min_qty');

        // Missing reward_qty
        $this->postJson('/api/admin/discounts', [
            'name' => 'Invalid reward_qty',
            'coupon' => 'ERR-REW-1',
            'type' => BuyXGetY::class,
            'starts_at' => '2026-08-31T12:00:00.000Z',
            'condition_type' => 'specific_products',
            'condition_product_ids' => [$variantA->product->id],
            'reward_product_ids' => [$variantB->product->id],
            'data' => ['min_qty' => 2],
        ])->assertUnprocessable()->assertJsonValidationErrors('data.reward_qty');

        // Empty condition_product_ids
        $this->postJson('/api/admin/discounts', [
            'name' => 'Missing condition products',
            'coupon' => 'ERR-COND-1',
            'type' => BuyXGetY::class,
            'starts_at' => '2026-08-31T12:00:00.000Z',
            'condition_type' => 'specific_products',
            'condition_product_ids' => [],
            'reward_product_ids' => [$variantB->product->id],
            'data' => ['min_qty' => 2, 'reward_qty' => 1],
        ])->assertUnprocessable()->assertJsonValidationErrors('condition_product_ids');

        // Empty condition_collection_ids
        $this->postJson('/api/admin/discounts', [
            'name' => 'Missing condition collections',
            'coupon' => 'ERR-COND-2',
            'type' => BuyXGetY::class,
            'starts_at' => '2026-08-31T12:00:00.000Z',
            'condition_type' => 'specific_collections',
            'condition_collection_ids' => [],
            'reward_product_ids' => [$variantB->product->id],
            'data' => ['min_qty' => 2, 'reward_qty' => 1],
        ])->assertUnprocessable()->assertJsonValidationErrors('condition_collection_ids');

        // Empty reward_product_ids
        $this->postJson('/api/admin/discounts', [
            'name' => 'Missing reward products',
            'coupon' => 'ERR-REW-2',
            'type' => BuyXGetY::class,
            'starts_at' => '2026-08-31T12:00:00.000Z',
            'condition_type' => 'specific_products',
            'condition_product_ids' => [$variantA->product->id],
            'reward_product_ids' => [],
            'data' => ['min_qty' => 2, 'reward_qty' => 1],
        ])->assertUnprocessable()->assertJsonValidationErrors('reward_product_ids');
    }

    public function test_cart_apply_with_buy_x_get_y_discount(): void
    {
        $this->setUpLunarPrerequisites();
        $this->actingAsCoreAdmin();

        $variantA = $this->createProductWithVariant(5000); // $50
        $variantB = $this->createProductWithVariant(3000); // $30

        // Create Buy 2 of Product A, Get 1 of Product B Free (max_reward_qty = 1)
        $this->postJson('/api/admin/discounts', [
            'name' => 'Buy 2 A Get 1 B Free',
            'coupon' => 'B2G1FREE',
            'type' => BuyXGetY::class,
            'starts_at' => '2026-08-31T12:00:00.000Z',
            'condition_type' => 'specific_products',
            'condition_product_ids' => [$variantA->product->id],
            'reward_product_ids' => [$variantB->product->id],
            'data' => [
                'min_qty' => 2,
                'reward_qty' => 1,
                'max_reward_qty' => 1,
                'automatically_add_rewards' => false,
            ],
        ])->assertCreated();

        $currency = Currency::getDefault();
        $channel = Channel::getDefault();

        // 1. Cart with 1x Product A + 1x Product B -> Condition not met (1 < 2), 0 discount
        $cart1 = Cart::create(['currency_id' => $currency->id, 'channel_id' => $channel->id]);
        $cart1->add($variantA, 1);
        $cart1->add($variantB, 1);
        $cart1->coupon_code = 'B2G1FREE';
        $cart1->discounts = collect();
        $cart1->discountBreakdown = collect();

        $cart1 = app(DiscountManagerInterface::class)->resetDiscounts()->apply($cart1);
        $lineB1 = $cart1->lines->firstWhere('purchasable_id', $variantB->id);
        $this->assertSame(0, $lineB1->discountTotal?->value ?? 0);
        $this->assertSame(3000, $lineB1->subTotal->value);
        $this->assertSame(3000, $lineB1->subTotalDiscounted->value);

        // 2. Cart with 2x Product A + 1x Product B -> Condition met (2 >= 2), Product B is 100% free!
        $cart2 = Cart::create(['currency_id' => $currency->id, 'channel_id' => $channel->id]);
        $cart2->add($variantA, 2);
        $cart2->add($variantB, 1);
        $cart2->coupon_code = 'B2G1FREE';
        $cart2->discounts = collect();
        $cart2->discountBreakdown = collect();

        $cart2 = app(DiscountManagerInterface::class)->resetDiscounts()->apply($cart2);
        $lineA2 = $cart2->lines->firstWhere('purchasable_id', $variantA->id);
        $lineB2 = $cart2->lines->firstWhere('purchasable_id', $variantB->id);

        $this->assertSame(0, $lineA2->discountTotal?->value ?? 0);
        $this->assertSame(10000, $lineA2->subTotal->value);
        $this->assertSame(10000, $lineA2->subTotalDiscounted->value);

        // Reward line is 100% free (discount = 3000, subTotalDiscounted = 0)
        $this->assertSame(3000, $lineB2->discountTotal->value);
        $this->assertSame(3000, $lineB2->subTotal->value);
        $this->assertSame(0, $lineB2->subTotalDiscounted->value);

        // 3. Cart with 4x Product A + 2x Product B -> floor(4/2)*1 = 2, but max_reward_qty = 1 caps reward to 1 item free
        $cart3 = Cart::create(['currency_id' => $currency->id, 'channel_id' => $channel->id]);
        $cart3->add($variantA, 4);
        $cart3->add($variantB, 2);
        $cart3->coupon_code = 'B2G1FREE';
        $cart3->discounts = collect();
        $cart3->discountBreakdown = collect();

        $cart3 = app(DiscountManagerInterface::class)->resetDiscounts()->apply($cart3);
        $lineB3 = $cart3->lines->firstWhere('purchasable_id', $variantB->id);

        // 1 of the 2 units is free: discount = 3000, subTotal = 6000, subTotalDiscounted = 3000
        $this->assertSame(3000, $lineB3->discountTotal->value);
        $this->assertSame(6000, $lineB3->subTotal->value);
        $this->assertSame(3000, $lineB3->subTotalDiscounted->value);
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
                'name' => new Text('Test Product '.Str::random(5)),
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
            'sku' => 'SKU-'.Str::upper(Str::random(6)),
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

        $country = Country::firstOrCreate(
            ['iso2' => 'US'],
            [
                'name' => 'United States',
                'iso3' => 'USA',
                'phonecode' => '1',
                'capital' => 'Washington',
                'currency' => 'USD',
                'native' => 'United States',
                'emoji' => 'US',
                'emoji_u' => 'U+1F1FA U+1F1F8',
            ]
        );

        $taxZone = TaxZone::firstOrCreate(
            ['name' => 'Default Tax Zone'],
            ['zone_type' => 'country', 'price_display' => 'tax_exclusive', 'active' => true, 'default' => true]
        );

        if (! $taxZone->countries()->where('country_id', $country->id)->exists()) {
            $taxZone->countries()->create([
                'country_id' => $country->id,
            ]);
        }

        $taxClass = TaxClass::firstOrCreate(['name' => 'Default'], ['default' => true]);

        $taxRate = TaxRate::firstOrCreate(
            ['name' => 'Default Tax Rate'],
            [
                'tax_zone_id' => $taxZone->id,
                'priority' => 1,
            ]
        );

        TaxRateAmount::firstOrCreate(
            [
                'tax_rate_id' => $taxRate->id,
                'tax_class_id' => $taxClass->id,
            ],
            [
                'percentage' => 0,
            ]
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
