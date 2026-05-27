<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Lunar\Models\Channel;
use Lunar\Models\Currency;
use Lunar\Models\Language;
use Lunar\Models\ProductVariant;
use Lunar\Models\TaxClass;
use Tests\TestCase;

class CartApiTest extends TestCase
{
    use RefreshDatabase;

    private ProductVariant $variant;

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpLunarPrerequisites();
        $this->variant = $this->createVariant();
    }

    public function test_guest_can_get_empty_cart(): void
    {
        $token = \Illuminate\Support\Str::uuid()->toString();

        $this->getJson('/api/cart', ['X-Cart-Token' => $token])
            ->assertOk()
            ->assertJsonStructure(['token', 'lines', 'subtotal', 'total']);
    }

    public function test_guest_can_add_item_to_cart(): void
    {
        $token = \Illuminate\Support\Str::uuid()->toString();

        $this->postJson('/api/cart/lines', [
            'variantId' => $this->variant->id,
            'quantity'  => 2,
        ], ['X-Cart-Token' => $token])
            ->assertStatus(201)
            ->assertJsonPath('lines.0.variantId', $this->variant->id)
            ->assertJsonPath('lines.0.quantity', 2);
    }

    public function test_adding_same_variant_increments_quantity(): void
    {
        $token = \Illuminate\Support\Str::uuid()->toString();
        $headers = ['X-Cart-Token' => $token];

        $this->postJson('/api/cart/lines', ['variantId' => $this->variant->id, 'quantity' => 1], $headers);
        $response = $this->postJson('/api/cart/lines', ['variantId' => $this->variant->id, 'quantity' => 1], $headers);

        $this->assertEquals(2, $response->json('lines.0.quantity'));
    }

    public function test_can_remove_line_from_cart(): void
    {
        $token = \Illuminate\Support\Str::uuid()->toString();
        $headers = ['X-Cart-Token' => $token];

        $addResponse = $this->postJson('/api/cart/lines', [
            'variantId' => $this->variant->id,
            'quantity'  => 1,
        ], $headers)->assertStatus(201);

        $lineId = $addResponse->json('lines.0.id');

        $this->deleteJson("/api/cart/lines/{$lineId}", [], $headers)
            ->assertOk()
            ->assertJsonPath('lines', []);
    }

    public function test_auth_user_cart_is_separate_from_guest_cart(): void
    {
        $user = User::factory()->create();
        Sanctum::actingAs($user);

        $this->postJson('/api/cart/lines', [
            'variantId' => $this->variant->id,
            'quantity'  => 3,
        ])->assertStatus(201)->assertJsonPath('lines.0.quantity', 3);

        // Guest with no token gets its own empty cart
        $guestToken = \Illuminate\Support\Str::uuid()->toString();
        $this->getJson('/api/cart', ['X-Cart-Token' => $guestToken])
            ->assertOk()
            ->assertJsonPath('lines', []);
    }

    public function test_add_line_validates_variant_exists(): void
    {
        $this->postJson('/api/cart/lines', [
            'variantId' => 99999,
            'quantity'  => 1,
        ], ['X-Cart-Token' => \Illuminate\Support\Str::uuid()->toString()])
            ->assertUnprocessable();
    }

    public function test_guest_cannot_add_out_of_stock_variant_to_cart(): void
    {
        $this->variant->update(['stock' => 0, 'backorder' => false]);

        $this->postJson('/api/cart/lines', [
            'variantId' => $this->variant->id,
            'quantity'  => 1,
        ], ['X-Cart-Token' => \Illuminate\Support\Str::uuid()->toString()])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['quantity']);
    }

    public function test_cart_line_includes_inventory_snapshot(): void
    {
        $token = \Illuminate\Support\Str::uuid()->toString();
        $this->variant->update(['stock' => 2, 'low_stock_threshold' => 5, 'backorder' => false]);

        $this->postJson('/api/cart/lines', [
            'variantId' => $this->variant->id,
            'quantity'  => 1,
        ], ['X-Cart-Token' => $token])
            ->assertCreated()
            ->assertJsonPath('lines.0.stock', 2)
            ->assertJsonPath('lines.0.available', true)
            ->assertJsonPath('lines.0.lowStockWarning', true)
            ->assertJsonPath('lines.0.stockStatus', 'low_stock');
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private function setUpLunarPrerequisites(): void
    {
        Language::factory()->create(['code' => 'en', 'name' => 'English', 'default' => true]);
        Currency::factory()->create(['code' => 'USD', 'name' => 'US Dollar', 'exchange_rate' => 1, 'decimal_places' => 2, 'default' => true, 'enabled' => true, 'factor' => 100]);
        Channel::factory()->create(['name' => 'Web', 'handle' => 'web', 'default' => true, 'url' => 'http://localhost']);
        TaxClass::factory()->create(['name' => 'Default Tax Class', 'default' => true]);
    }

    private function createVariant(): ProductVariant
    {
        $productType = \Lunar\Models\ProductType::factory()->create(['name' => 'Default']);
        $product     = \Lunar\Models\Product::factory()->create([
            'product_type_id' => $productType->id,
            'status'          => 'published',
        ]);

        $variant = ProductVariant::factory()->create(['product_id' => $product->id]);

        \Lunar\Models\Price::factory()->create([
            'priceable_type' => ProductVariant::class,
            'priceable_id'   => $variant->id,
            'price'          => 2999,
            'currency_id'    => Currency::getDefault()->id,
            'customer_group_id' => null,
            'min_quantity'   => 1,
        ]);

        return $variant;
    }
}
