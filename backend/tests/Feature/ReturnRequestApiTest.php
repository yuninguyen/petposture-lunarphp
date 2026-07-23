<?php

namespace Tests\Feature;

use App\Mail\OrderReturnApproved;
use App\Mail\OrderReturnRejected;
use App\Mail\OrderReturnRequested;
use App\Models\OrderReturnRequest;
use App\Models\User;
use App\Services\ReturnRequestService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Laravel\Sanctum\Sanctum;
use Lunar\FieldTypes\Text;
use Lunar\Models\Channel;
use Lunar\Models\Country;
use Lunar\Models\Currency;
use Lunar\Models\CustomerGroup;
use Lunar\Models\Language;
use Lunar\Models\Order;
use Lunar\Models\OrderLine;
use Lunar\Models\Price;
use Lunar\Models\Product;
use Lunar\Models\ProductType;
use Lunar\Models\ProductVariant;
use Lunar\Models\TaxClass;
use Lunar\Models\TaxRate;
use Lunar\Models\TaxRateAmount;
use Lunar\Models\TaxZone;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class ReturnRequestApiTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Queue::fake();
        Mail::fake();
    }

    // ─── POST /api/orders/return-requests (guest) ──────────────────────────

    public function test_guest_can_submit_return_request_for_delivered_order(): void
    {
        ['order_id' => $orderId, 'reference' => $reference, 'order_line_id' => $lineId] = $this->placeDeliveredOrder();

        $response = $this->postJson('/api/orders/return-requests', $this->returnRequestPayload($reference, $lineId));

        $response->assertCreated()
            ->assertJsonPath('data.order_reference', $reference)
            ->assertJsonPath('data.status', OrderReturnRequest::STATUS_REQUESTED)
            ->assertJsonPath('data.reason', 'Wrong size')
            ->assertJsonPath('data.items.0.order_line_id', (string) $lineId)
            ->assertJsonPath('data.items.0.quantity', 1);

        $this->assertDatabaseHas('order_return_requests', [
            'order_id' => $orderId,
            'status' => OrderReturnRequest::STATUS_REQUESTED,
        ]);

        Mail::assertSent(OrderReturnRequested::class);
    }

    public function test_guest_can_submit_return_request_for_shipped_order_without_delivered_at(): void
    {
        ['reference' => $reference, 'order_line_id' => $lineId] = $this->placeShippedOrder();

        $this->postJson('/api/orders/return-requests', $this->returnRequestPayload($reference, $lineId))
            ->assertCreated()
            ->assertJsonPath('data.status', OrderReturnRequest::STATUS_REQUESTED);
    }

    public function test_return_request_returns_not_found_for_unknown_credentials(): void
    {
        $response = $this->postJson('/api/orders/return-requests', $this->returnRequestPayload('MISSING-REF', 1));

        $response->assertNotFound()
            ->assertJsonPath('message', 'No order found with these credentials.');
    }

    public function test_return_request_validates_required_fields(): void
    {
        $this->postJson('/api/orders/return-requests', [])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['order_reference', 'email', 'reason', 'items']);
    }

    public function test_return_request_rejects_order_not_delivered_or_shipped(): void
    {
        $variant = $this->createPurchasableVariant();
        $placeResponse = $this->postJson('/api/checkout/place-order', $this->checkoutPayload($variant));
        $reference = $placeResponse->json('order.reference');
        $orderId = $placeResponse->json('order.id');
        $lineId = OrderLine::where('order_id', $orderId)->value('id');

        $response = $this->postJson('/api/orders/return-requests', $this->returnRequestPayload($reference, $lineId));

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['order']);
    }

    public function test_return_request_rejects_duplicate_active_request(): void
    {
        ['reference' => $reference, 'order_line_id' => $lineId] = $this->placeDeliveredOrder();

        $this->postJson('/api/orders/return-requests', $this->returnRequestPayload($reference, $lineId))
            ->assertCreated();

        $this->postJson('/api/orders/return-requests', $this->returnRequestPayload($reference, $lineId))
            ->assertStatus(422)
            ->assertJsonValidationErrors(['order']);
    }

    public function test_return_request_rejects_when_outside_30_day_window(): void
    {
        ['order_id' => $orderId, 'reference' => $reference, 'order_line_id' => $lineId] = $this->placeDeliveredOrder();

        $this->setDeliveredAt($orderId, now()->subDays(31));

        $this->postJson('/api/orders/return-requests', $this->returnRequestPayload($reference, $lineId))
            ->assertStatus(422)
            ->assertJsonValidationErrors(['order']);
    }

    public function test_return_request_allows_within_30_day_window(): void
    {
        ['order_id' => $orderId, 'reference' => $reference, 'order_line_id' => $lineId] = $this->placeDeliveredOrder();

        $this->setDeliveredAt($orderId, now()->subDays(29));

        $this->postJson('/api/orders/return-requests', $this->returnRequestPayload($reference, $lineId))
            ->assertCreated();
    }

    // ─── ReturnRequestService (direct) ──────────────────────────────────────

    public function test_service_rejects_empty_items_array(): void
    {
        ['order_id' => $orderId] = $this->placeDeliveredOrder();
        $order = Order::find($orderId);

        $this->expectException(ValidationException::class);

        app(ReturnRequestService::class)->create($order, [], 'No longer needed', null);
    }

    // ─── Admin endpoints ─────────────────────────────────────────────────────

    public function test_admin_can_list_return_requests(): void
    {
        ['reference' => $reference, 'order_line_id' => $lineId] = $this->placeDeliveredOrder();
        $this->postJson('/api/orders/return-requests', $this->returnRequestPayload($reference, $lineId))->assertCreated();

        $this->makeAdmin();

        $this->getJson('/api/admin/return-requests')
            ->assertOk()
            ->assertJsonPath('data.0.order_reference', $reference);
    }

    public function test_admin_can_view_single_return_request(): void
    {
        $returnRequestId = $this->createReturnRequestViaApi()['id'];

        $this->makeAdmin();

        $this->getJson("/api/admin/return-requests/{$returnRequestId}")
            ->assertOk()
            ->assertJsonPath('data.id', (string) $returnRequestId);
    }

    public function test_admin_view_returns_404_for_unknown_return_request(): void
    {
        $this->makeAdmin();

        $this->getJson('/api/admin/return-requests/999999')
            ->assertNotFound();
    }

    public function test_admin_can_approve_return_request(): void
    {
        $returnRequestId = $this->createReturnRequestViaApi()['id'];

        $this->makeAdmin();

        $response = $this->postJson("/api/admin/return-requests/{$returnRequestId}/approve", [
            'rma_address' => '123 Warehouse Rd, Austin, TX 78701',
            'refund_amount' => 25.50,
            'admin_note' => 'Approved, awaiting item.',
        ]);

        $response->assertOk()
            ->assertJsonPath('data.status', OrderReturnRequest::STATUS_APPROVED)
            ->assertJsonPath('data.rma_address', '123 Warehouse Rd, Austin, TX 78701')
            ->assertJsonPath('data.refund_amount', 25.5)
            ->assertJsonPath('data.admin_note', 'Approved, awaiting item.');

        Mail::assertSent(OrderReturnApproved::class);
    }

    public function test_admin_can_reject_return_request(): void
    {
        $returnRequestId = $this->createReturnRequestViaApi()['id'];

        $this->makeAdmin();

        $response = $this->postJson("/api/admin/return-requests/{$returnRequestId}/reject", [
            'admin_note' => 'Outside policy window.',
        ]);

        $response->assertOk()
            ->assertJsonPath('data.status', OrderReturnRequest::STATUS_REJECTED)
            ->assertJsonPath('data.admin_note', 'Outside policy window.');

        Mail::assertSent(OrderReturnRejected::class);
    }

    public function test_admin_cannot_approve_a_return_request_that_is_not_requested(): void
    {
        $returnRequestId = $this->createReturnRequestViaApi()['id'];

        $this->makeAdmin();

        $this->postJson("/api/admin/return-requests/{$returnRequestId}/reject", [])->assertOk();

        $this->postJson("/api/admin/return-requests/{$returnRequestId}/approve", [
            'rma_address' => '123 Warehouse Rd',
        ])->assertStatus(422)->assertJsonValidationErrors(['status']);
    }

    public function test_admin_can_complete_an_approved_return_request_and_marks_order_returned(): void
    {
        $created = $this->createReturnRequestViaApi();
        $returnRequestId = $created['id'];
        $orderId = $created['order_id'];

        $this->makeAdmin();

        $this->postJson("/api/admin/return-requests/{$returnRequestId}/approve", [
            'rma_address' => '123 Warehouse Rd',
        ])->assertOk();

        $response = $this->postJson("/api/admin/return-requests/{$returnRequestId}/complete");

        $response->assertOk()
            ->assertJsonPath('data.status', OrderReturnRequest::STATUS_COMPLETED);

        $order = Order::find($orderId);
        $this->assertSame('returned', $order->meta['fulfillment_status'] ?? null);
    }

    public function test_admin_cannot_complete_a_return_request_that_is_not_approved(): void
    {
        $returnRequestId = $this->createReturnRequestViaApi()['id'];

        $this->makeAdmin();

        $this->postJson("/api/admin/return-requests/{$returnRequestId}/complete")
            ->assertStatus(422)
            ->assertJsonValidationErrors(['status']);
    }

    public function test_admin_return_request_actions_are_forbidden_for_non_admin(): void
    {
        $returnRequestId = $this->createReturnRequestViaApi()['id'];

        $user = User::factory()->create();
        Role::findOrCreate('customer', 'web');
        $user->assignRole('customer');
        Sanctum::actingAs($user);

        $this->getJson('/api/admin/return-requests')->assertForbidden();
        $this->getJson("/api/admin/return-requests/{$returnRequestId}")->assertForbidden();
        $this->postJson("/api/admin/return-requests/{$returnRequestId}/approve")->assertForbidden();
        $this->postJson("/api/admin/return-requests/{$returnRequestId}/reject")->assertForbidden();
        $this->postJson("/api/admin/return-requests/{$returnRequestId}/complete")->assertForbidden();
    }

    // ─── Helpers ─────────────────────────────────────────────────────────────

    /**
     * @return array{id: int, order_id: int}
     */
    private function createReturnRequestViaApi(): array
    {
        ['order_id' => $orderId, 'reference' => $reference, 'order_line_id' => $lineId] = $this->placeDeliveredOrder();

        $response = $this->postJson('/api/orders/return-requests', $this->returnRequestPayload($reference, $lineId));
        $response->assertCreated();

        return [
            'id' => (int) $response->json('data.id'),
            'order_id' => $orderId,
        ];
    }

    private function returnRequestPayload(string $reference, int $orderLineId): array
    {
        return [
            'order_reference' => $reference,
            'email' => 'guest@petposture.com',
            'reason' => 'Wrong size',
            'note' => 'Please process quickly.',
            'items' => [
                ['order_line_id' => $orderLineId, 'quantity' => 1],
            ],
        ];
    }

    private function setDeliveredAt(int $orderId, \DateTimeInterface $deliveredAt): void
    {
        $order = Order::find($orderId);
        $meta = (array) ($order->meta ?? []);
        $meta['delivered_at'] = $deliveredAt->format('Y-m-d H:i:s');
        $order->update(['meta' => $meta]);
    }

    /**
     * @return array{order_id: int, reference: string, order_line_id: int}
     */
    private function placeDeliveredOrder(): array
    {
        $result = $this->placeOrderAndAdvance(['markProcessing', 'markShipped', 'markDelivered']);

        return $result;
    }

    /**
     * @return array{order_id: int, reference: string, order_line_id: int}
     */
    private function placeShippedOrder(): array
    {
        return $this->placeOrderAndAdvance(['markProcessing', 'markShipped']);
    }

    /**
     * @param  array<int, string>  $actions
     * @return array{order_id: int, reference: string, order_line_id: int}
     */
    private function placeOrderAndAdvance(array $actions): array
    {
        $variant = $this->createPurchasableVariant();
        $placeResponse = $this->postJson('/api/checkout/place-order', $this->checkoutPayload($variant));
        $placeResponse->assertCreated();

        $orderId = $placeResponse->json('order.id');
        $reference = $placeResponse->json('order.reference');

        $order = Order::find($orderId);
        $meta = (array) ($order->meta ?? []);
        $meta['payment_intent_id'] = 'pi_test_'.Str::lower(Str::random(12));
        $meta['payment_status'] = 'paid';
        $order->update(['status' => 'payment-received', 'meta' => $meta]);

        $this->makeAdmin();

        foreach ($actions as $action) {
            $this->postJson("/api/orders/{$orderId}/actions/{$action}")->assertOk();
        }

        $lineId = OrderLine::where('order_id', $orderId)->value('id');

        return ['order_id' => $orderId, 'reference' => $reference, 'order_line_id' => $lineId];
    }

    private function makeAdmin(): User
    {
        $admin = User::factory()->create();
        Role::findOrCreate('admin', 'web');
        $admin->assignRole('admin');
        Sanctum::actingAs($admin);

        return $admin;
    }

    private function createPurchasableVariant(): ProductVariant
    {
        $this->setUpLunarPrerequisites();

        $productType = ProductType::firstOrCreate(['name' => 'General']);
        $taxClass = TaxClass::firstOrCreate(['name' => 'Default'], ['default' => true]);
        $channel = Channel::getDefault();
        $customerGroup = CustomerGroup::query()->where('default', true)->first();
        $currency = Currency::getDefault();

        $product = Product::create([
            'product_type_id' => $productType->id,
            'status' => 'published',
            'attribute_data' => [
                'name' => new Text('Test Pet Bed'),
                'description' => new Text('Supportive orthopedic pet bed'),
                'image_url' => new Text('/assets/Pug-Dog-Bed.jpg'),
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

        $variant = ProductVariant::create([
            'product_id' => $product->id,
            'tax_class_id' => $taxClass->id,
            'sku' => 'TEST-BED-'.Str::upper(Str::random(6)),
            'stock' => 25,
            'shippable' => true,
        ]);

        Price::create([
            'customer_group_id' => null,
            'currency_id' => $currency->id,
            'priceable_type' => $variant->getMorphClass(),
            'priceable_id' => $variant->id,
            'price' => 8999,
            'min_quantity' => 1,
        ]);

        return $variant;
    }

    private function setUpLunarPrerequisites(): void
    {
        $language = Language::firstOrCreate(
            ['code' => 'en'],
            ['name' => 'English', 'default' => true]
        );
        if (! $language->default) {
            $language->forceFill(['default' => true])->save();
        }

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

        $customerGroup = CustomerGroup::firstOrCreate(
            ['handle' => 'retail'],
            [
                'name' => 'Retail',
                'default' => true,
            ]
        );
        if (! $customerGroup->default) {
            $customerGroup->forceFill(['default' => true])->save();
        }

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

        $taxClass = TaxClass::firstOrCreate(
            ['name' => 'Default'],
            ['default' => true]
        );
        if (! $taxClass->default) {
            $taxClass->forceFill(['default' => true])->save();
        }

        $taxZone = TaxZone::firstOrCreate(
            ['name' => 'Default Tax Zone'],
            [
                'zone_type' => 'country',
                'price_display' => 'tax_exclusive',
                'active' => true,
                'default' => true,
            ]
        );
        if (! $taxZone->default || ! $taxZone->active) {
            $taxZone->forceFill(['default' => true, 'active' => true])->save();
        }

        if (! $taxZone->countries()->where('country_id', $country->id)->exists()) {
            $taxZone->countries()->create([
                'country_id' => $country->id,
            ]);
        }

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

    private function checkoutPayload(ProductVariant $variant, array $overrides = []): array
    {
        return array_replace_recursive([
            'items' => [
                [
                    'variantId' => $variant->id,
                    'quantity' => 1,
                ],
            ],
            'shipping' => [
                'email' => 'guest@petposture.com',
                'first_name' => 'Jane',
                'last_name' => 'Doe',
                'company' => null,
                'line_one' => '123 Congress Ave',
                'line_two' => 'Unit 4B',
                'city' => 'Austin',
                'state' => 'TX',
                'postcode' => '78701',
                'country' => 'United States',
                'phone' => '5125550101',
            ],
            'billing_same_as_shipping' => true,
            'shipping_method' => 'standard',
            'payment_method' => 'cod',
        ], $overrides);
    }
}
