<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Lunar\DiscountTypes\AmountOff;
use Lunar\FieldTypes\Text;
use Lunar\Models\Channel;
use Lunar\Models\Country;
use Lunar\Models\Currency;
use Lunar\Models\CustomerGroup;
use Lunar\Models\Discount;
use Lunar\Models\Language;
use Lunar\Models\Product;
use Lunar\Models\ProductType;
use Lunar\Models\ProductVariant;
use Lunar\Models\Price;
use Lunar\Models\TaxRate;
use Lunar\Models\TaxRateAmount;
use Lunar\Models\TaxClass;
use Lunar\Models\TaxZone;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class CheckoutApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_place_order_creates_a_guest_order(): void
    {
        $variant = $this->createPurchasableVariant();

        $response = $this->postJson('/api/checkout/place-order', $this->checkoutPayload($variant));

        $response->assertCreated()
            ->assertJsonPath('success', true)
            ->assertJsonPath('order.status', 'awaiting-payment')
            ->assertJsonPath('order.customer_email', 'guest@petposture.com')
            ->assertJsonPath('order.tracking_number', $response->json('order.reference'))
            ->assertJsonPath('order.tax_state', 'TX')
            ->assertJsonPath('order.tax_rate_percentage', 8.2)
            ->assertJsonPath('order.tax_state_rate_percentage', 6.25)
            ->assertJsonPath('order.tax_avg_local_rate_percentage', 1.95)
            ->assertJsonPath('order.shipping_method', 'standard')
            ->assertJsonPath('order.payment_method', 'cod')
            ->assertJsonPath('order.payment_label', 'Cash on delivery')
            ->assertJsonPath('order.payment_gateway', 'manual-offline')
            ->assertJsonPath('order.payment_collection', 'offline')
            ->assertJsonPath('order.customer_note', null)
            ->assertJsonPath('order.order_events.0.type', 'order.created')
            ->assertJsonPath('order.tax_total', '7.38')
            ->assertJsonPath('order.shipping_address.city', 'Austin')
            ->assertJsonPath('order.billing_address.postcode', '78701');
    }

    public function test_track_order_returns_the_created_order(): void
    {
        $variant = $this->createPurchasableVariant();

        $placeOrderResponse = $this->postJson('/api/checkout/place-order', $this->checkoutPayload($variant));
        $reference = $placeOrderResponse->json('order.reference');

        $response = $this->postJson('/api/orders/track', [
            'tracking_number' => $reference,
            'email' => 'guest@petposture.com',
        ]);

        $response->assertOk()
            ->assertJsonPath('data.reference', $reference)
            ->assertJsonPath('data.customer_email', 'guest@petposture.com')
            ->assertJsonPath('data.tracking_number', $reference)
            ->assertJsonPath('data.tax_state', 'TX')
            ->assertJsonPath('data.tax_rate_percentage', 8.2)
            ->assertJsonPath('data.tax_state_rate_percentage', 6.25)
            ->assertJsonPath('data.tax_avg_local_rate_percentage', 1.95)
            ->assertJsonPath('data.shipping_method', 'standard')
            ->assertJsonPath('data.payment_method', 'cod')
            ->assertJsonPath('data.payment_label', 'Cash on delivery')
            ->assertJsonPath('data.shipping_address.line_one', '123 Congress Ave')
            ->assertJsonPath('data.shipping_address.city', 'Austin');
    }

    public function test_track_order_returns_not_found_for_invalid_credentials(): void
    {
        $response = $this->postJson('/api/orders/track', [
            'tracking_number' => 'MISSING-ORDER',
            'email' => 'missing@petposture.com',
        ]);

        $response->assertNotFound()
            ->assertJsonPath('message', 'No order found with these credentials.');
    }

    public function test_retry_payment_prepares_a_new_card_intent_for_eligible_order(): void
    {
        config()->set('services.stripe.key', 'pk_test_retry');
        config()->set('services.stripe.secret', null);

        $variant = $this->createPurchasableVariant();
        $payload = $this->checkoutPayload($variant, [
            'payment_method' => 'card',
            'payment_context' => [
                'intent_id' => 'pi_original_retry_123',
                'client_secret' => 'pi_original_retry_123_secret',
                'status' => 'requires_payment_method',
            ],
        ]);

        $placeOrderResponse = $this->postJson('/api/checkout/place-order', $payload);
        $reference = $placeOrderResponse->json('order.reference');

        $response = $this->postJson('/api/orders/retry-payment', [
            'tracking_number' => $reference,
            'email' => 'guest@petposture.com',
        ]);

        $response->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('payment_intent.gateway', 'stripe')
            ->assertJsonPath('payment_intent.mode', 'placeholder')
            ->assertJsonPath('order.payment_status', 'pending')
            ->assertJsonPath('order.order_events.1.type', 'payment.retry_prepared');

        $this->assertStringStartsWith('pi_placeholder_', $response->json('payment_intent.intent_id'));
    }

    public function test_tax_quote_returns_state_average_provider_metadata(): void
    {
        $response = $this->postJson('/api/checkout/tax-quote', [
            'shipping' => [
                'state' => 'TX',
                'country' => 'United States',
            ],
            'subtotal_amount' => 89.99,
            'discount_amount' => 5.00,
        ]);

        $response->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('quote.provider', 'state-average')
            ->assertJsonPath('quote.provider_requested', 'state-average')
            ->assertJsonPath('quote.provider_fallback_applied', false)
            ->assertJsonPath('quote.state_code', 'TX')
            ->assertJsonPath('quote.rate_percentage', 8.2)
            ->assertJsonPath('quote.tax_amount', 697)
            ->assertJsonPath('quote.is_estimate', true);
    }

    public function test_tax_quote_falls_back_to_state_average_when_stripe_tax_is_unavailable(): void
    {
        config()->set('commerce.tax.provider', 'stripe-tax');
        config()->set('commerce.tax.fallback_provider', 'state-average');
        config()->set('services.stripe.secret', null);

        $response = $this->postJson('/api/checkout/tax-quote', [
            'shipping' => [
                'state' => 'TX',
                'country' => 'United States',
                'postcode' => '78701',
            ],
            'subtotal_amount' => 89.99,
            'discount_amount' => 5.00,
        ]);

        $response->assertOk()
            ->assertJsonPath('quote.provider', 'state-average')
            ->assertJsonPath('quote.provider_requested', 'stripe-tax')
            ->assertJsonPath('quote.provider_fallback_applied', true)
            ->assertJsonPath('quote.provider_fallback', 'state-average')
            ->assertJsonPath('quote.tax_amount', 697)
            ->assertJsonPath('quote.is_estimate', true);
    }

    public function test_tax_quote_falls_back_to_state_average_when_stripe_tax_api_errors(): void
    {
        config()->set('commerce.tax.provider', 'stripe-tax');
        config()->set('commerce.tax.fallback_provider', 'state-average');
        config()->set('services.stripe.secret', 'sk_test_tax');

        Http::fake([
            'https://api.stripe.com/v1/tax/calculations' => Http::response([
                'error' => [
                    'message' => 'Temporary Stripe Tax error.',
                ],
            ], 500),
        ]);

        $response = $this->postJson('/api/checkout/tax-quote', [
            'shipping' => [
                'state' => 'TX',
                'country' => 'United States',
                'postcode' => '78701',
                'city' => 'Austin',
            ],
            'subtotal_amount' => 89.99,
            'discount_amount' => 5.00,
        ]);

        $response->assertOk()
            ->assertJsonPath('quote.provider', 'state-average')
            ->assertJsonPath('quote.provider_requested', 'stripe-tax')
            ->assertJsonPath('quote.provider_fallback_applied', true)
            ->assertJsonPath('quote.provider_fallback', 'state-average')
            ->assertJsonPath('quote.provider_fallback_reason', 'Temporary Stripe Tax error.')
            ->assertJsonPath('quote.tax_amount', 697);
    }

    public function test_apply_coupon_returns_discount_details(): void
    {
        $variant = $this->createPurchasableVariant();
        $currency = Currency::getDefault();

        Discount::create([
            'name' => 'SAVE10',
            'handle' => 'save10',
            'coupon' => 'SAVE10',
            'type' => AmountOff::class,
            'starts_at' => now()->subHour(),
            'ends_at' => now()->addDay(),
            'priority' => 1,
            'stop' => true,
            'uses' => 0,
            'data' => [
                'fixed_value' => true,
                'fixed_values' => [
                    $currency->code => 1000,
                ],
            ],
        ]);

        $response = $this->postJson('/api/apply-coupon', [
            'coupon_code' => 'SAVE10',
            'items' => [
                [
                    'variantId' => $variant->id,
                    'quantity' => 1,
                ],
            ],
        ]);

        $response->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('coupon.code', 'SAVE10')
            ->assertJsonPath('coupon.type', 'fixed_cart')
            ->assertJsonPath('coupon.amount', 10)
            ->assertJsonPath('discount_amount', 10);
    }

    public function test_apply_coupon_returns_not_found_for_unknown_coupon(): void
    {
        $variant = $this->createPurchasableVariant();

        $response = $this->postJson('/api/apply-coupon', [
            'coupon_code' => 'DOES-NOT-EXIST',
            'items' => [
                [
                    'variantId' => $variant->id,
                    'quantity' => 1,
                ],
            ],
        ]);

        $response->assertNotFound()
            ->assertJsonPath('success', false)
            ->assertJsonPath('message', 'Coupon code not found or expired.');
    }

    public function test_place_order_supports_express_shipping_and_coupon_code(): void
    {
        $variant = $this->createPurchasableVariant();
        $currency = Currency::getDefault();

        Discount::create([
            'name' => 'EXPRESS5',
            'handle' => 'express5',
            'coupon' => 'EXPRESS5',
            'type' => AmountOff::class,
            'starts_at' => now()->subHour(),
            'ends_at' => now()->addDay(),
            'priority' => 1,
            'stop' => true,
            'uses' => 0,
            'data' => [
                'fixed_value' => true,
                'fixed_values' => [
                    $currency->code => 500,
                ],
            ],
        ]);

        $payload = $this->checkoutPayload($variant, [
            'shipping_method' => 'express',
            'coupon_code' => 'EXPRESS5',
            'customer_note' => 'Leave at front door.',
        ]);

        $response = $this->postJson('/api/checkout/place-order', $payload);

        $response->assertCreated()
            ->assertJsonPath('order.status', 'awaiting-payment')
            ->assertJsonPath('order.shipping_method', 'express')
            ->assertJsonPath('order.payment_method', 'cod')
            ->assertJsonPath('order.payment_collection', 'offline')
            ->assertJsonPath('order.tracking_number', $response->json('order.reference'))
            ->assertJsonPath('order.customer_note', 'Leave at front door.')
            ->assertJsonPath('order.shipping_total', '25.00')
            ->assertJsonPath('order.sub_total', '89.99')
            ->assertJsonPath('order.discount_total', '5.00')
            ->assertJsonPath('order.tax_total', '6.97')
            ->assertJsonPath('order.total.decimal', 116.96);
        $this->assertSame('Leave at front door.', $response->json('order.notes'));
    }

    public function test_admin_can_update_order_operations(): void
    {
        $variant = $this->createPurchasableVariant();
        $placeOrderResponse = $this->postJson('/api/checkout/place-order', $this->checkoutPayload($variant));
        $orderId = $placeOrderResponse->json('order.id');

        $admin = User::factory()->create();
        Role::findOrCreate('admin', 'web');
        $admin->assignRole('admin');
        Sanctum::actingAs($admin);

        $response = $this->patchJson("/api/orders/{$orderId}", [
            'status' => 'processing',
            'tracking_number' => '1Z-TEST-TRACKING',
            'shipment_carrier' => 'ups',
            'internal_note' => 'Packed and handed to warehouse.',
        ]);

        $response->assertOk()
            ->assertJsonPath('data.status', 'processing')
            ->assertJsonPath('data.tracking_number', '1Z-TEST-TRACKING')
            ->assertJsonPath('data.internal_note', 'Packed and handed to warehouse.')
            ->assertJsonPath('data.fulfillment_status', 'processing')
            ->assertJsonPath('data.shipments.0.carrier', 'ups')
            ->assertJsonPath('data.shipments.0.tracking_url', 'https://www.ups.com/track?tracknum=1Z-TEST-TRACKING');
    }

    public function test_admin_can_run_order_action_endpoint(): void
    {
        $variant = $this->createPurchasableVariant();
        $placeOrderResponse = $this->postJson('/api/checkout/place-order', $this->checkoutPayload($variant));
        $orderId = $placeOrderResponse->json('order.id');

        $admin = User::factory()->create();
        Role::findOrCreate('admin', 'web');
        $admin->assignRole('admin');
        Sanctum::actingAs($admin);

        $paidResponse = $this->postJson("/api/orders/{$orderId}/actions/markPaid");
        $paidResponse->assertOk()
            ->assertJsonPath('data.status', 'payment-received')
            ->assertJsonPath('data.payment_status', 'paid')
            ->assertJsonPath('data.fulfillment_status', 'unfulfilled');

        $shippedTooEarly = $this->postJson("/api/orders/{$orderId}/actions/markShipped");
        $shippedTooEarly->assertStatus(422)
            ->assertJsonValidationErrors(['status']);

        $processingResponse = $this->postJson("/api/orders/{$orderId}/actions/markProcessing");
        $processingResponse->assertOk()
            ->assertJsonPath('data.status', 'processing');

        $shippedResponse = $this->postJson("/api/orders/{$orderId}/actions/markShipped", [
            'tracking_number' => '1Z-ACTION-TRACKING',
            'shipment_carrier' => 'fedex',
            'internal_note' => 'Packed and dispatched.',
        ]);

        $shippedResponse->assertOk()
            ->assertJsonPath('data.status', 'shipped')
            ->assertJsonPath('data.tracking_number', '1Z-ACTION-TRACKING')
            ->assertJsonPath('data.internal_note', 'Packed and dispatched.')
            ->assertJsonPath('data.shipments.1.tracking_number', '1Z-ACTION-TRACKING')
            ->assertJsonPath('data.shipments.1.carrier', 'fedex')
            ->assertJsonPath('data.shipments.1.tracking_url', 'https://www.fedex.com/fedextrack/?trknbr=1Z-ACTION-TRACKING')
            ->assertJsonPath('data.shipments.1.status', 'in_transit');

        $this->assertNotNull($paidResponse->json('data.payment_received_at'));
        $this->assertNotNull($processingResponse->json('data.processing_started_at'));
        $this->assertNotNull($shippedResponse->json('data.shipped_at'));
        $this->assertContains('status.payment-received', array_column($shippedResponse->json('data.order_events'), 'type'));
        $this->assertContains('status.shipped', array_column($shippedResponse->json('data.order_events'), 'type'));
    }

    public function test_admin_update_rejects_unknown_shipment_carrier(): void
    {
        $variant = $this->createPurchasableVariant();
        $placeOrderResponse = $this->postJson('/api/checkout/place-order', $this->checkoutPayload($variant));
        $orderId = $placeOrderResponse->json('order.id');

        $admin = User::factory()->create();
        Role::findOrCreate('admin', 'web');
        $admin->assignRole('admin');
        Sanctum::actingAs($admin);

        $response = $this->patchJson("/api/orders/{$orderId}", [
            'shipment_carrier' => 'blue_dart',
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['shipment_carrier']);
    }

    public function test_admin_can_create_additional_shipment(): void
    {
        $variant = $this->createPurchasableVariant();
        $placeOrderResponse = $this->postJson('/api/checkout/place-order', $this->checkoutPayload($variant));
        $orderId = $placeOrderResponse->json('order.id');

        $admin = User::factory()->create();
        Role::findOrCreate('admin', 'web');
        $admin->assignRole('admin');
        Sanctum::actingAs($admin);

        $this->patchJson("/api/orders/{$orderId}", [
            'tracking_number' => '1Z-FIRST-SHIPMENT',
            'shipment_carrier' => 'ups',
        ])->assertOk();

        $response = $this->postJson("/api/orders/{$orderId}/shipments", [
            'tracking_number' => '9400-SECOND-SHIPMENT',
            'shipment_carrier' => 'usps',
        ]);

        $response->assertOk()
            ->assertJsonPath('data.shipments.0.tracking_number', '1Z-FIRST-SHIPMENT')
            ->assertJsonPath('data.shipments.1.tracking_number', '9400-SECOND-SHIPMENT')
            ->assertJsonPath('data.shipments.1.carrier', 'usps')
            ->assertJsonPath('data.shipments.1.tracking_url', 'https://tools.usps.com/go/TrackConfirmAction?qtc_tLabels1=9400-SECOND-SHIPMENT');

        $this->assertContains('shipment.created', array_column($response->json('data.order_events'), 'type'));
    }

    public function test_payment_methods_endpoint_returns_supported_checkout_methods(): void
    {
        $response = $this->getJson('/api/checkout/payment-methods');

        $response->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('methods.0.method', 'cod')
            ->assertJsonPath('methods.1.method', 'card')
            ->assertJsonPath('methods.1.gateway', 'stripe')
            ->assertJsonPath('methods.1.collection', 'direct')
            ->assertJsonPath('methods.2.method', 'paypal');
    }

    public function test_prepare_payment_intent_returns_placeholder_payload_when_stripe_is_not_configured(): void
    {
        config()->set('services.stripe.key', null);
        config()->set('services.stripe.secret', null);

        $response = $this->postJson('/api/checkout/payment-intent', [
            'payment_method' => 'card',
            'amount' => 10999,
            'currency' => 'usd',
            'email' => 'guest@petposture.com',
        ]);

        $response->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('payment_intent.gateway', 'stripe')
            ->assertJsonPath('payment_intent.mode', 'placeholder')
            ->assertJsonPath('payment_intent.amount', 10999)
            ->assertJsonPath('payment_intent.currency', 'USD');

        $this->assertStringStartsWith('pi_placeholder_', $response->json('payment_intent.intent_id'));
        $this->assertStringStartsWith('pi_placeholder_secret_', $response->json('payment_intent.client_secret'));
    }

    public function test_stripe_webhook_marks_card_order_as_paid(): void
    {
        config()->set('services.stripe.webhook_secret', null);

        $variant = $this->createPurchasableVariant();
        $payload = $this->checkoutPayload($variant, [
            'payment_method' => 'card',
            'payment_context' => [
                'intent_id' => 'pi_test_paid_123',
                'client_secret' => 'pi_test_paid_123_secret_abc',
                'status' => 'requires_payment_method',
            ],
        ]);

        $placeOrderResponse = $this->postJson('/api/checkout/place-order', $payload);
        $placeOrderResponse->assertCreated()
            ->assertJsonPath('order.payment_intent_id', 'pi_test_paid_123')
            ->assertJsonPath('order.payment_status', 'pending');

        $webhookResponse = $this->postJson('/api/webhooks/stripe', [
            'id' => 'evt_test_paid_123',
            'type' => 'payment_intent.succeeded',
            'data' => [
                'object' => [
                    'id' => 'pi_test_paid_123',
                    'status' => 'succeeded',
                ],
            ],
        ]);

        $webhookResponse->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('result.processed', true)
            ->assertJsonPath('result.payment_status', 'paid');

        $reference = $placeOrderResponse->json('order.reference');

        $trackedOrderResponse = $this->postJson('/api/orders/track', [
            'tracking_number' => $reference,
            'email' => 'guest@petposture.com',
        ]);

        $trackedOrderResponse->assertOk()
            ->assertJsonPath('data.status', 'payment-received')
            ->assertJsonPath('data.payment_status', 'paid')
            ->assertJsonPath('data.payment_intent_status', 'succeeded')
            ->assertJsonPath('data.payment_last_event_type', 'payment_intent.succeeded');

        $this->assertNotNull($trackedOrderResponse->json('data.payment_received_at'));
        $this->assertContains('status.payment-received', array_column($trackedOrderResponse->json('data.order_events'), 'type'));
    }

    public function test_duplicate_stripe_webhook_event_is_ignored(): void
    {
        config()->set('services.stripe.webhook_secret', null);

        $variant = $this->createPurchasableVariant();
        $payload = $this->checkoutPayload($variant, [
            'payment_method' => 'card',
            'payment_context' => [
                'intent_id' => 'pi_test_duplicate_123',
                'client_secret' => 'pi_test_duplicate_123_secret_abc',
                'status' => 'requires_payment_method',
            ],
        ]);

        $this->postJson('/api/checkout/place-order', $payload)->assertCreated();

        $eventPayload = [
            'id' => 'evt_test_duplicate_123',
            'type' => 'payment_intent.succeeded',
            'data' => [
                'object' => [
                    'id' => 'pi_test_duplicate_123',
                    'status' => 'succeeded',
                ],
            ],
        ];

        $this->postJson('/api/webhooks/stripe', $eventPayload)
            ->assertOk()
            ->assertJsonPath('result.processed', true);

        $this->postJson('/api/webhooks/stripe', $eventPayload)
            ->assertOk()
            ->assertJsonPath('result.processed', false)
            ->assertJsonPath('result.reason', 'duplicate_event');
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
            'sku' => 'TEST-BED-' . Str::upper(Str::random(6)),
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
