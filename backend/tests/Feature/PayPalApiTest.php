<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Lunar\FieldTypes\Text;
use Mockery;
use Lunar\Models\Channel;
use Lunar\Models\Country;
use Lunar\Models\Currency;
use Lunar\Models\CustomerGroup;
use Lunar\Models\Language;
use Lunar\Models\Order;
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

class PayPalApiTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Queue::fake();

        // Force placeholder mode / skip signature verification unless a test explicitly configures otherwise —
        // mirrors how CheckoutApiTest neutralizes real Stripe credentials.
        config()->set('services.paypal.client_id', null);
        config()->set('services.paypal.client_secret', null);
        config()->set('services.paypal.webhook_id', null);
    }

    // ─── Prepare order ───────────────────────────────────────────────────────

    public function test_prepare_paypal_order_returns_placeholder_payload_when_not_configured(): void
    {
        $variant = $this->createPurchasableVariant();

        $response = $this->postJson('/api/checkout/paypal-order', [
            'payment_method' => 'paypal',
            'items' => [
                ['variantId' => $variant->id, 'quantity' => 1],
            ],
            'shipping' => ['state' => 'TX', 'country' => 'United States'],
            'currency' => 'usd',
        ]);

        $response->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('paypal_order.status', 'CREATED')
            ->assertJsonPath('paypal_order.mode', 'placeholder')
            ->assertJsonPath('paypal_order.currency', 'USD');

        $this->assertStringStartsWith('PAYPAL-PLACEHOLDER-', $response->json('paypal_order.paypal_order_id'));
    }

    public function test_prepare_paypal_order_rejects_out_of_stock_variant(): void
    {
        $variant = $this->createPurchasableVariant();
        $variant->update(['stock' => 0, 'backorder' => false]);

        $this->postJson('/api/checkout/paypal-order', [
            'payment_method' => 'paypal',
            'items' => [
                ['variantId' => $variant->id, 'quantity' => 1],
            ],
        ])->assertUnprocessable()
            ->assertJsonValidationErrors(['quantity']);
    }

    // ─── Place order with PayPal ─────────────────────────────────────────────

    public function test_place_order_with_paypal_stores_paypal_order_id_in_meta(): void
    {
        $variant = $this->createPurchasableVariant();

        $payload = $this->checkoutPayload($variant, [
            'payment_method' => 'paypal',
            'payment_context' => [
                'paypal_order_id' => 'PAYPAL-TEST-ORDER-123',
            ],
        ]);

        $response = $this->postJson('/api/checkout/place-order', $payload);

        $response->assertCreated()
            ->assertJsonMissingPath('order.payment_method')
            ->assertJsonMissingPath('order.payment_gateway')
            ->assertJsonMissingPath('order.payment_collection');

        $order = Order::find($response->json('order.id'));
        $this->assertSame('paypal', $order->meta['payment_method'] ?? null);
        $this->assertSame('paypal', $order->meta['payment_gateway'] ?? null);
        $this->assertSame('popup', $order->meta['payment_collection'] ?? null);
        $this->assertSame('PAYPAL-TEST-ORDER-123', $order->meta['paypal_order_id'] ?? null);
    }

    // ─── Capture ─────────────────────────────────────────────────────────────

    public function test_capture_paypal_order_sends_empty_json_body(): void
    {
        config()->set('services.paypal.client_id', 'test-client-id');
        config()->set('services.paypal.client_secret', 'test-client-secret');
        config()->set('services.paypal.mode', 'sandbox-test-'.Str::lower(Str::random(8)));
        Cache::forget('paypal_client_id');
        Cache::forget('paypal_client_secret');
        Cache::forget('paypal_mode');
        Cache::put('paypal_access_token_'.config('services.paypal.mode'), 'test-access-token');

        $captureResponse = new \Illuminate\Http\Client\Response(new \GuzzleHttp\Psr7\Response(
            200,
            ['Content-Type' => 'application/json'],
            json_encode([
                'status' => 'COMPLETED',
                'purchase_units' => [[
                    'payments' => ['captures' => [['id' => 'CAPTURE-123', 'status' => 'COMPLETED']]],
                ]],
            ], JSON_THROW_ON_ERROR),
        ));

        Http::shouldReceive('withToken')->once()->with('test-access-token')->andReturnSelf();
        Http::shouldReceive('post')->once()
            ->with('https://api-m.sandbox.paypal.com/v2/checkout/orders/APPROVED-ORDER-123/capture', Mockery::on(
                fn ($body): bool => $body instanceof \stdClass && get_object_vars($body) === [],
            ))
            ->andReturn($captureResponse);

        $capture = app(\App\Services\PayPalService::class)->captureOrder('APPROVED-ORDER-123');

        $this->assertSame('COMPLETED', $capture['status']);
    }

    public function test_capture_paypal_order_marks_order_as_paid(): void
    {
        $variant = $this->createPurchasableVariant();
        $payload = $this->checkoutPayload($variant, [
            'payment_method' => 'paypal',
            'payment_context' => ['paypal_order_id' => 'PAYPAL-TEST-CAPTURE-123'],
        ]);

        $this->postJson('/api/checkout/place-order', $payload)->assertCreated();

        $response = $this->postJson('/api/checkout/paypal-capture', [
            'paypal_order_id' => 'PAYPAL-TEST-CAPTURE-123',
        ]);

        $response->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('order.payment_status', 'paid')
            ->assertJsonPath('order.payment_gateway', 'paypal')
            ->assertJsonPath('capture.status', 'COMPLETED')
            ->assertJsonPath('capture.mode', 'placeholder');

        $this->assertStringStartsWith('CAPTURE-PLACEHOLDER-', $response->json('capture.capture_id'));

        $order = Order::query()->where('meta->paypal_order_id', 'PAYPAL-TEST-CAPTURE-123')->firstOrFail();
        $this->assertStringStartsWith('CAPTURE-PLACEHOLDER-', $order->meta['paypal_capture_id'] ?? '');
    }

    public function test_capture_paypal_order_rejects_unknown_paypal_order_id(): void
    {
        $this->postJson('/api/checkout/paypal-capture', [
            'paypal_order_id' => 'PAYPAL-DOES-NOT-EXIST',
        ])->assertNotFound();
    }

    // ─── Webhook ─────────────────────────────────────────────────────────────

    public function test_paypal_webhook_marks_order_as_paid(): void
    {
        $variant = $this->createPurchasableVariant();
        $payload = $this->checkoutPayload($variant, [
            'payment_method' => 'paypal',
            'payment_context' => ['paypal_order_id' => 'PAYPAL-TEST-WEBHOOK-123'],
        ]);

        $this->postJson('/api/checkout/place-order', $payload)->assertCreated();

        $webhookResponse = $this->postJson('/api/webhooks/paypal', [
            'id' => 'WH-EVENT-TEST-123',
            'event_type' => 'PAYMENT.CAPTURE.COMPLETED',
            'resource' => [
                'id' => 'CAPTURE-TEST-123',
                'supplementary_data' => [
                    'related_ids' => [
                        'order_id' => 'PAYPAL-TEST-WEBHOOK-123',
                    ],
                ],
                'payer' => [
                    'email_address' => 'buyer@example.com',
                ],
            ],
        ]);

        $webhookResponse->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('result.processed', true)
            ->assertJsonPath('result.payment_status', 'paid');

        $order = Order::query()->where('meta->paypal_order_id', 'PAYPAL-TEST-WEBHOOK-123')->firstOrFail();
        $this->assertSame('paid', $order->meta['payment_status'] ?? null);
        $this->assertSame('buyer@example.com', $order->meta['paypal_payer_email'] ?? null);
    }

    public function test_duplicate_paypal_webhook_event_is_ignored(): void
    {
        $variant = $this->createPurchasableVariant();
        $payload = $this->checkoutPayload($variant, [
            'payment_method' => 'paypal',
            'payment_context' => ['paypal_order_id' => 'PAYPAL-TEST-DUPLICATE-123'],
        ]);

        $this->postJson('/api/checkout/place-order', $payload)->assertCreated();

        $eventPayload = [
            'id' => 'WH-EVENT-DUPLICATE-123',
            'event_type' => 'PAYMENT.CAPTURE.COMPLETED',
            'resource' => [
                'id' => 'CAPTURE-DUPLICATE-123',
                'supplementary_data' => [
                    'related_ids' => ['order_id' => 'PAYPAL-TEST-DUPLICATE-123'],
                ],
            ],
        ];

        $this->postJson('/api/webhooks/paypal', $eventPayload)
            ->assertOk()
            ->assertJsonPath('result.processed', true);

        $this->postJson('/api/webhooks/paypal', $eventPayload)
            ->assertOk()
            ->assertJsonPath('result.processed', false)
            ->assertJsonPath('result.reason', 'duplicate_event');

        $this->assertDatabaseCount('paypal_webhook_events', 1);
        $this->assertDatabaseHas('paypal_webhook_events', [
            'event_id' => 'WH-EVENT-DUPLICATE-123',
            'event_type' => 'PAYMENT.CAPTURE.COMPLETED',
            'status' => 'processed',
        ]);
    }

    public function test_paypal_webhook_marks_event_orphaned_when_order_not_found(): void
    {
        $response = $this->postJson('/api/webhooks/paypal', [
            'id' => 'WH-EVENT-ORPHAN-123',
            'event_type' => 'PAYMENT.CAPTURE.COMPLETED',
            'resource' => [
                'id' => 'CAPTURE-ORPHAN-123',
                'supplementary_data' => [
                    'related_ids' => ['order_id' => 'PAYPAL-ORDER-NEVER-PLACED'],
                ],
            ],
        ]);

        $response->assertOk()
            ->assertJsonPath('result.processed', false)
            ->assertJsonPath('result.reason', 'order_not_found');

        $this->assertDatabaseHas('paypal_webhook_events', [
            'event_id' => 'WH-EVENT-ORPHAN-123',
            'status' => 'orphaned',
        ]);
    }

    // ─── Refund ──────────────────────────────────────────────────────────────

    public function test_admin_can_issue_full_refund_on_paid_paypal_order(): void
    {
        $variant = $this->createPurchasableVariant();
        ['order_id' => $orderId] = $this->createPaidPayPalOrder($variant);

        $this->makeAdmin();

        $response = $this->postJson("/api/admin/orders/{$orderId}/refund");

        $response->assertOk()
            ->assertJsonPath('data.payment_status', 'refunded')
            ->assertJsonPath('data.refund_status', 'refunded');

        $this->assertNotNull($response->json('data.refund_id'));
        $this->assertStringStartsWith('REFUND-PLACEHOLDER-', $response->json('data.refund_id'));
        $this->assertGreaterThan(0, $response->json('data.refund_amount'));
        $this->assertContains('payment.refunded', array_column($response->json('data.order_events'), 'type'));
    }

    public function test_admin_can_issue_partial_refund_on_paid_paypal_order(): void
    {
        $variant = $this->createPurchasableVariant();
        ['order_id' => $orderId] = $this->createPaidPayPalOrder($variant);

        $this->makeAdmin();

        $response = $this->postJson("/api/admin/orders/{$orderId}/refund", ['amount' => 10.00]);

        $response->assertOk()
            ->assertJsonPath('data.refund_status', 'refunded')
            ->assertJsonPath('data.refund_amount', 1000);

        $this->assertNotSame('refunded', $response->json('data.payment_status'));
        $this->assertContains('payment.refunded', array_column($response->json('data.order_events'), 'type'));
    }

    public function test_refund_rejects_paypal_order_without_capture_id(): void
    {
        $variant = $this->createPurchasableVariant();
        $placeResponse = $this->postJson('/api/checkout/place-order', $this->checkoutPayload($variant, [
            'payment_method' => 'paypal',
            'payment_context' => ['paypal_order_id' => 'PAYPAL-NO-CAPTURE-123'],
        ]));
        $orderId = $placeResponse->json('order.id');

        // Mark paid without ever capturing (no paypal_capture_id set).
        $order = Order::find($orderId);
        $meta = (array) ($order->meta ?? []);
        $meta['payment_status'] = 'paid';
        $order->update(['meta' => $meta]);

        $this->makeAdmin();

        $this->postJson("/api/admin/orders/{$orderId}/refund")
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['refund']);
    }

    public function test_refund_is_forbidden_for_non_admin_on_paypal_order(): void
    {
        $variant = $this->createPurchasableVariant();
        ['order_id' => $orderId] = $this->createPaidPayPalOrder($variant);

        $user = User::factory()->create();
        Role::findOrCreate('customer', 'web');
        $user->assignRole('customer');
        Sanctum::actingAs($user);

        $this->postJson("/api/admin/orders/{$orderId}/refund")->assertForbidden();
    }

    // ─── Helpers ─────────────────────────────────────────────────────────────

    private function makeAdmin(): User
    {
        $admin = User::factory()->create();
        Role::findOrCreate('admin', 'web');
        $admin->assignRole('admin');
        Sanctum::actingAs($admin);

        return $admin;
    }

    /**
     * Place a PayPal order and directly mark it captured/paid with a fake capture id.
     * Avoids depending on the real capture endpoint's own assertions from bleeding into refund tests.
     *
     * @return array{order_id: int, capture_id: string, reference: string}
     */
    private function createPaidPayPalOrder(ProductVariant $variant): array
    {
        $paypalOrderId = 'PAYPAL-TEST-'.Str::upper(Str::random(10));

        $orderResponse = $this->postJson('/api/checkout/place-order', $this->checkoutPayload($variant, [
            'payment_method' => 'paypal',
            'payment_context' => ['paypal_order_id' => $paypalOrderId],
        ]));
        $orderResponse->assertCreated();

        $orderId = $orderResponse->json('order.id');
        $captureId = 'CAPTURE-TEST-'.Str::upper(Str::random(10));

        $order = Order::find($orderId);
        $meta = (array) ($order->meta ?? []);
        $meta['payment_status'] = 'paid';
        $meta['paypal_capture_id'] = $captureId;
        $order->update([
            'status' => 'payment-received',
            'meta' => $meta,
        ]);

        return [
            'order_id' => $orderId,
            'capture_id' => $captureId,
            'reference' => $orderResponse->json('order.reference'),
        ];
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
