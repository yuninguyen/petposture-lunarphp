<?php

namespace Tests\Feature;

use App\Models\CheckoutSession;
use App\Models\ShippingMethod;
use App\Models\StripeWebhookEvent;
use App\Models\User;
use App\Models\UserAddress;
use App\Services\CheckoutService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;
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

class CheckoutApiTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Queue::fake();
    }

    public function test_place_order_creates_a_guest_order(): void
    {
        $variant = $this->createPurchasableVariant();

        $response = $this->postJson('/api/checkout/place-order', $this->checkoutPayload($variant));

        $response->assertCreated()
            ->assertJsonPath('success', true)
            ->assertJsonPath('order.status', 'awaiting-payment')
            ->assertJsonStructure([
                'order' => ['id', 'reference', 'tracking_access_token', 'tracking_access_expires_at'],
            ])
            ->assertJsonMissingPath('order.customer_email')
            ->assertJsonMissingPath('order.payment_method')
            ->assertJsonMissingPath('order.shipping_address')
            ->assertJsonMissingPath('order.billing_address')
            ->assertJsonMissingPath('order.payment_intent_id');

        $order = Order::query()->findOrFail($response->json('order.id'));
        $this->assertSame('guest@petposture.com', $order->customer_reference);
        $this->assertSame('TX', $order->meta['tax_state']);
        $this->assertSame('cod', $order->meta['payment_method']);
        $this->assertSame(64, strlen((string) $response->json('order.tracking_access_token')));
    }

    public function test_place_order_auto_saves_shipping_address_for_logged_in_customer(): void
    {
        $variant = $this->createPurchasableVariant();
        $user = User::factory()->create(['email' => 'guest@petposture.com']);
        Role::findOrCreate('customer', 'web');
        $user->assignRole('customer');
        Sanctum::actingAs($user);

        $this->assertSame(0, UserAddress::query()->where('user_id', $user->id)->count());

        $this->postJson('/api/checkout/place-order', $this->checkoutPayload($variant))->assertCreated();

        $address = UserAddress::query()->where('user_id', $user->id)->first();
        $this->assertNotNull($address);
        $this->assertSame('123 Congress Ave', $address->line_one);
        $this->assertSame('78701', $address->postcode);
        $this->assertSame('US', $address->country_code);
        $this->assertTrue($address->is_default);
    }

    public function test_place_order_does_not_duplicate_an_already_saved_address(): void
    {
        $variant = $this->createPurchasableVariant();
        $user = User::factory()->create(['email' => 'guest@petposture.com']);
        Role::findOrCreate('customer', 'web');
        $user->assignRole('customer');
        Sanctum::actingAs($user);

        $this->postJson('/api/checkout/place-order', $this->checkoutPayload($variant))->assertCreated();
        $this->postJson('/api/checkout/place-order', $this->checkoutPayload($variant))->assertCreated();

        $this->assertSame(1, UserAddress::query()->where('user_id', $user->id)->count());
    }

    public function test_place_order_does_not_save_address_for_guest_checkout(): void
    {
        $variant = $this->createPurchasableVariant();

        $this->postJson('/api/checkout/place-order', $this->checkoutPayload($variant))->assertCreated();

        $this->assertSame(0, UserAddress::query()->count());
    }

    public function test_checkout_session_ignores_client_financial_state_and_returns_server_totals(): void
    {
        $variant = $this->createPurchasableVariant();

        $response = $this->postJson('/api/checkout/session', [
            'items' => [[
                'variantId' => $variant->id,
                'quantity' => 1,
                'unit_price_minor' => 1,
            ]],
            'shipping' => [
                'email' => 'totals@petposture.com',
                'state' => 'TX',
                'country' => 'US',
                'tax_minor' => 1,
            ],
            'shipping_method' => 'standard',
            'payment_method' => 'card',
            'payment_context' => [
                'intent_id' => 'pi_attacker_controlled',
                'status' => 'succeeded',
            ],
            'currency' => 'EUR',
            'status' => 'paid',
            'subtotal_minor' => 1,
            'discount_minor' => 8998,
            'tax_minor' => 1,
            'shipping_minor' => 1,
            'total_minor' => 1,
            'totals' => ['total_minor' => 1],
        ]);

        $response->assertOk()
            ->assertJsonPath('session.status', 'open')
            ->assertJsonPath('session.currency', 'USD')
            ->assertJsonPath('session.totals.currency', 'USD')
            ->assertJsonPath('session.totals.subtotal_minor', 8999)
            ->assertJsonPath('session.totals.discount_minor', 0)
            ->assertJsonPath('session.totals.shipping_minor', 0);
        $this->assertNotSame(1, $response->json('session.totals.tax_minor'));

        $totals = $response->json('session.totals');
        foreach (['subtotal_minor', 'discount_minor', 'tax_minor', 'shipping_minor', 'total_minor'] as $key) {
            $this->assertIsInt($totals[$key]);
        }
        $this->assertSame(
            $totals['subtotal_minor'] - $totals['discount_minor'] + $totals['shipping_minor'] + $totals['tax_minor'],
            $totals['total_minor'],
        );

        $session = CheckoutSession::query()->where('token', $response->json('session.token'))->firstOrFail();
        $this->assertArrayNotHasKey('payment_context', $session->payload);
        $this->assertArrayNotHasKey('unit_price_minor', $session->payload['items'][0]);
        $this->assertArrayNotHasKey('tax_minor', $session->payload['shipping']);
        $this->assertArrayNotHasKey('totals', $session->payload);
        $this->assertArrayNotHasKey('status', $session->payload);
        $this->assertSame('USD', $session->currency);
    }

    public function test_track_order_returns_the_created_order(): void
    {
        $variant = $this->createPurchasableVariant();

        $placeOrderResponse = $this->postJson('/api/checkout/place-order', $this->checkoutPayload($variant));
        $reference = $placeOrderResponse->json('order.reference');
        $trackingToken = $placeOrderResponse->json('order.tracking_access_token');

        $response = $this->postJson('/api/orders/track', [
            'tracking_token' => $trackingToken,
            'email' => 'guest@petposture.com',
        ]);

        $response->assertOk()
            ->assertJsonPath('data.reference', $reference)
            ->assertJsonPath('data.tracking_number', null)
            ->assertJsonPath('data.status', 'awaiting-payment')
            ->assertJsonPath('data.fulfillment_status', 'unfulfilled')
            ->assertJsonPath('data.carrier', null)
            ->assertJsonPath('data.shipping_address.city', 'Austin')
            ->assertJsonPath('data.shipping_address.postcode', '78701')
            ->assertJsonPath('data.customer_email', 'guest@petposture.com');
    }

    public function test_track_order_returns_not_found_for_invalid_credentials(): void
    {
        $response = $this->postJson('/api/orders/track', [
            'tracking_token' => Str::random(64),
            'email' => 'missing@petposture.com',
        ]);

        $response->assertNotFound()
            ->assertJsonPath('message', 'Unable to access this order.');
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
        $trackingToken = $placeOrderResponse->json('order.tracking_access_token');

        $response = $this->postJson('/api/orders/retry-payment', [
            'tracking_token' => $trackingToken,
            'email' => 'guest@petposture.com',
        ]);

        $response->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('payment_intent.gateway', 'stripe')
            ->assertJsonPath('payment_intent.mode', 'placeholder')
            ->assertJsonPath('order.status', 'awaiting-payment')
            ->assertJsonMissingPath('order.payment_status');

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

    public function test_place_order_rejects_out_of_stock_variant(): void
    {
        $variant = $this->createPurchasableVariant();
        $variant->update(['stock' => 0, 'backorder' => false]);

        $this->postJson('/api/checkout/place-order', $this->checkoutPayload($variant))
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['quantity']);
    }

    public function test_prepare_payment_intent_rejects_out_of_stock_variant(): void
    {
        $variant = $this->createPurchasableVariant();
        $variant->update(['stock' => 0, 'backorder' => false]);

        $this->postJson('/api/checkout/payment-intent', [
            'payment_method' => 'card',
            'items' => [
                [
                    'variantId' => $variant->id,
                    'quantity' => 1,
                ],
            ],
            'shipping' => [
                'state' => 'TX',
                'country' => 'United States',
            ],
            'currency' => 'usd',
            'email' => 'guest@petposture.com',
        ])->assertUnprocessable()
            ->assertJsonValidationErrors(['quantity']);
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
            ->assertJsonMissingPath('order.payment_method')
            ->assertJsonMissingPath('order.shipping_address');

        $order = Order::query()->findOrFail($response->json('order.id'));
        $this->assertSame('express', $order->meta['shipping_method']);
        $this->assertSame('cod', $order->meta['payment_method']);
        $this->assertSame('offline', $order->meta['payment_collection']);
        $this->assertSame('Leave at front door.', $order->meta['customer_note']);
        $this->assertSame('Leave at front door.', $order->notes);
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

        // The state machine doesn't allow awaiting-payment -> processing directly;
        // payment must be marked received first (see OrderStateMachine::ALLOWED_TRANSITIONS).
        $this->patchJson("/api/orders/{$orderId}", ['status' => 'payment-received'])->assertOk();

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
            ->assertJsonPath('data.shipments.0.tracking_number', '1Z-ACTION-TRACKING')
            ->assertJsonPath('data.shipments.0.carrier', 'fedex')
            ->assertJsonPath('data.shipments.0.tracking_url', 'https://www.fedex.com/fedextrack/?trknbr=1Z-ACTION-TRACKING')
            ->assertJsonPath('data.shipments.0.status', 'in_transit');

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

        $variant = $this->createPurchasableVariant();

        $response = $this->postJson('/api/checkout/payment-intent', [
            'payment_method' => 'card',
            'items' => [
                [
                    'variantId' => $variant->id,
                    'quantity' => 1,
                ],
            ],
            'currency' => 'usd',
            'email' => 'guest@petposture.com',
        ]);

        $response->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('payment_intent.gateway', 'stripe')
            ->assertJsonPath('payment_intent.mode', 'placeholder')
            ->assertJsonPath('payment_intent.amount', 8999)
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
        $placeOrderResponse->assertCreated();
        $this->assertSame(64, strlen((string) $placeOrderResponse->json('order.tracking_access_token')));

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

        $trackedOrderResponse = $this->postJson('/api/orders/track', [
            'tracking_token' => $placeOrderResponse->json('order.tracking_access_token'),
            'email' => 'guest@petposture.com',
        ]);

        $trackedOrderResponse->assertOk()
            ->assertJsonPath('data.status', 'payment-received')
            ->assertJsonPath('data.tracking_number', null)
            ->assertJsonPath('data.fulfillment_status', 'unfulfilled')
            ->assertJsonMissingPath('data.payment_status');

        // Public tracking endpoint: staff-only/internal fields must never leak here.
        $trackedOrderResponse->assertJsonMissingPath('data.internal_note');
        $trackedOrderResponse->assertJsonMissingPath('data.payment_intent_id');
        $trackedOrderResponse->assertJsonMissingPath('data.order_events');
        $trackedOrderResponse->assertJsonMissingPath('data.available_actions');
        $trackedOrderResponse->assertJsonMissingPath('data.refund_status');
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

        $this->assertDatabaseCount('stripe_webhook_events', 1);
        $this->assertDatabaseHas('stripe_webhook_events', [
            'event_id' => 'evt_test_duplicate_123',
            'event_type' => 'payment_intent.succeeded',
            'payment_intent_id' => 'pi_test_duplicate_123',
            'status' => 'processed',
        ]);

        $storedEvent = StripeWebhookEvent::query()->where('event_id', 'evt_test_duplicate_123')->first();
        $this->assertSame('succeeded', data_get($storedEvent?->payload, 'data.object.status'));
    }

    // ─── Shipping Rates ──────────────────────────────────────────────────────

    public function test_shipping_rates_returns_default_standard_and_express(): void
    {
        $response = $this->getJson('/api/checkout/shipping-rates');

        $response->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('rates.0.id', 'standard')
            ->assertJsonPath('rates.0.price', 15)
            ->assertJsonPath('rates.0.price_minor', 1500)
            ->assertJsonPath('rates.1.id', 'express')
            ->assertJsonPath('rates.1.price', 25)
            ->assertJsonPath('rates.1.price_minor', 2500)
            ->assertJsonPath('rates.0.free_over', 50);
    }

    public function test_shipping_rates_returns_free_standard_when_subtotal_meets_threshold(): void
    {
        // Seeded by the shipping_methods migration: standard is $15, free over $50.
        $response = $this->getJson('/api/checkout/shipping-rates?subtotal_minor=5000');

        $response->assertOk()
            ->assertJsonPath('rates.0.id', 'standard')
            ->assertJsonPath('rates.0.price_minor', 0)
            ->assertJsonPath('rates.0.free_over', 50)
            ->assertJsonPath('rates.1.id', 'express')
            ->assertJsonPath('rates.1.price_minor', 2500);

        // Below threshold: standard should cost the configured rate ($15).
        $below = $this->getJson('/api/checkout/shipping-rates?subtotal_minor=4999');
        $below->assertOk()->assertJsonPath('rates.0.price_minor', 1500);
    }

    public function test_shipping_rates_returns_zero_for_all_when_coupon_has_free_shipping(): void
    {
        $discount = Discount::create([
            'name' => 'FREESHIP',
            'handle' => 'freeship-test',
            'coupon' => 'FREESHIP',
            'type' => AmountOff::class,
            'starts_at' => now()->subHour(),
            'ends_at' => now()->addDay(),
            'priority' => 1,
            'stop' => true,
            'uses' => 0,
            'data' => ['free_shipping' => true],
        ]);

        $response = $this->getJson('/api/checkout/shipping-rates?coupon_code=FREESHIP&subtotal_minor=3000');

        $response->assertOk()
            ->assertJsonPath('rates.0.price_minor', 0)
            ->assertJsonPath('rates.1.price_minor', 0);

        $discount->delete();
    }

    public function test_shipping_rates_respects_setting_override_for_express_price(): void
    {
        ShippingMethod::where('code', 'express')->update(['price' => 9.99]);

        $response = $this->getJson('/api/checkout/shipping-rates');

        $response->assertOk()
            ->assertJsonPath('rates.1.id', 'express')
            ->assertJsonPath('rates.1.price_minor', 999)
            ->assertJsonPath('rates.1.price', 9.99);
    }

    public function test_admin_order_resource_exposes_remaining_shippable_quantities_and_refund_reason_options(): void
    {
        $variant = $this->createPurchasableVariant();
        $orderId = $this->postJson('/api/checkout/place-order', $this->checkoutPayload($variant, [
            'items' => [['variantId' => $variant->id, 'quantity' => 2]],
        ]))->json('order.id');
        $orderLineId = Order::query()->findOrFail($orderId)->lines()->where('type', '!=', 'shipping')->value('id');

        $this->makeAdmin();

        $response = $this->getJson("/api/admin/orders/{$orderId}");

        $response->assertOk()
            ->assertJsonPath("data.remaining_shippable_quantities.{$orderLineId}", 2)
            ->assertJsonPath('data.refund_reason_options.0', [
                'value' => 'return_approved',
                'label' => 'Approved Return Request',
            ]);
        $this->assertInstanceOf(\stdClass::class, json_decode($response->getContent())->data->remaining_shippable_quantities);
    }

    public function test_admin_can_create_a_shipment_for_only_selected_partial_quantity(): void
    {
        $variant = $this->createPurchasableVariant();
        $orderId = $this->postJson('/api/checkout/place-order', $this->checkoutPayload($variant, [
            'items' => [['variantId' => $variant->id, 'quantity' => 2]],
        ]))->json('order.id');
        $orderLineId = Order::query()->findOrFail($orderId)->lines()->where('type', '!=', 'shipping')->value('id');

        $this->makeAdmin();

        $response = $this->postJson("/api/orders/{$orderId}/shipments", [
            'tracking_number' => '1Z-PARTIAL-SHIPMENT',
            'shipment_carrier' => 'ups',
            'items' => [[
                'order_line_id' => $orderLineId,
                'quantity' => 1,
            ]],
        ]);

        $response->assertOk()
            ->assertJsonPath("data.remaining_shippable_quantities.{$orderLineId}", 1);
        $this->assertInstanceOf(\stdClass::class, json_decode($response->getContent())->data->remaining_shippable_quantities);
        $this->assertDatabaseHas('order_shipment_items', [
            'order_line_id' => $orderLineId,
            'quantity' => 1,
        ]);
    }

    // ─── Refund ──────────────────────────────────────────────────────────────

    public function test_refund_requires_a_valid_reason_and_records_the_valid_reason_in_its_audit_path(): void
    {
        config()->set('services.stripe.webhook_secret', null);
        config()->set('services.stripe.secret', null);

        $variant = $this->createPurchasableVariant();
        ['order_id' => $orderId] = $this->createPaidCardOrder($variant);
        $this->makeAdmin();

        $this->postJson("/api/admin/orders/{$orderId}/refund")
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['reason']);
        $this->postJson("/api/admin/orders/{$orderId}/refund", ['reason' => 'not-a-reason'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['reason']);

        $response = $this->postJson("/api/admin/orders/{$orderId}/refund", ['reason' => 'defective']);

        $response->assertOk();
        $this->assertSame('defective', Order::query()->findOrFail($orderId)->meta['refund_reason']);
        $this->assertStringContainsString(
            'Reason: Defective / Damaged Item',
            collect($response->json('data.order_events'))->firstWhere('type', 'payment.refunded')['detail'],
        );
    }

    public function test_admin_can_issue_full_refund_on_paid_order(): void
    {
        config()->set('services.stripe.webhook_secret', null);
        config()->set('services.stripe.secret', null);

        $variant = $this->createPurchasableVariant();
        ['order_id' => $orderId] = $this->createPaidCardOrder($variant);

        $admin = $this->makeAdmin();

        $response = $this->postJson("/api/admin/orders/{$orderId}/refund", ['reason' => 'return_approved']);

        $response->assertOk()
            ->assertJsonPath('data.payment_status', 'refunded')
            ->assertJsonPath('data.refund_status', 'refunded');

        $this->assertNotNull($response->json('data.refund_id'));
        $this->assertNotNull($response->json('data.refund_amount'));
        $this->assertGreaterThan(0, $response->json('data.refund_amount'));
        $this->assertContains('payment.refunded', array_column($response->json('data.order_events'), 'type'));
    }

    public function test_admin_can_issue_partial_refund_and_records_correct_amount(): void
    {
        config()->set('services.stripe.webhook_secret', null);
        config()->set('services.stripe.secret', null);

        $variant = $this->createPurchasableVariant();
        ['order_id' => $orderId] = $this->createPaidCardOrder($variant);

        $this->makeAdmin();

        $response = $this->postJson("/api/admin/orders/{$orderId}/refund", [
            'amount' => 10.00,
            'reason' => 'customer_request',
        ]);

        $response->assertOk()
            ->assertJsonPath('data.refund_status', 'refunded')
            ->assertJsonPath('data.refund_amount', 1000);

        // payment_status should NOT be 'refunded' for a partial refund
        $this->assertNotSame('refunded', $response->json('data.payment_status'));
        $this->assertContains('payment.refunded', array_column($response->json('data.order_events'), 'type'));
    }

    public function test_refund_rejects_order_that_is_not_paid(): void
    {
        $variant = $this->createPurchasableVariant();
        $placeResponse = $this->postJson('/api/checkout/place-order', $this->checkoutPayload($variant));
        $orderId = $placeResponse->json('order.id');

        $this->makeAdmin();

        $this->postJson("/api/admin/orders/{$orderId}/refund", ['reason' => 'other'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['refund']);
    }

    public function test_refund_rejects_order_without_payment_intent(): void
    {
        $variant = $this->createPurchasableVariant();
        $placeResponse = $this->postJson('/api/checkout/place-order', $this->checkoutPayload($variant));
        $orderId = $placeResponse->json('order.id');

        // Manually mark as paid but strip the intent id to simulate an offline/COD order
        $order = Order::find($orderId);
        $meta = (array) ($order->meta ?? []);
        unset($meta['payment_intent_id']);
        $order->update(['meta' => $meta]);

        $this->makeAdmin();

        $this->postJson("/api/admin/orders/{$orderId}/refund", ['reason' => 'other'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['refund']);
    }

    public function test_refund_is_forbidden_for_non_admin(): void
    {
        $variant = $this->createPurchasableVariant();
        $orderId = $this->postJson('/api/checkout/place-order', $this->checkoutPayload($variant))->json('order.id');

        $user = User::factory()->create();
        Role::findOrCreate('customer', 'web');
        $user->assignRole('customer');
        Sanctum::actingAs($user);

        $this->postJson("/api/admin/orders/{$orderId}/refund")->assertForbidden();
    }

    // ─── Return ──────────────────────────────────────────────────────────────

    public function test_admin_can_mark_delivered_order_as_returned(): void
    {
        $variant = $this->createPurchasableVariant();
        ['order_id' => $orderId] = $this->createPaidCardOrder($variant);

        $admin = $this->makeAdmin();

        foreach (['markProcessing', 'markShipped', 'markDelivered'] as $action) {
            $this->postJson("/api/orders/{$orderId}/actions/{$action}")->assertOk();
        }

        $response = $this->postJson("/api/admin/orders/{$orderId}/return");

        $response->assertOk()
            ->assertJsonPath('data.fulfillment_status', 'returned');

        $this->assertNotNull($response->json('data.returned_at'));
        $this->assertContains('fulfillment.returned', array_column($response->json('data.order_events'), 'type'));
    }

    public function test_admin_can_mark_shipped_order_as_returned(): void
    {
        $variant = $this->createPurchasableVariant();
        ['order_id' => $orderId] = $this->createPaidCardOrder($variant);

        $this->makeAdmin();

        foreach (['markProcessing', 'markShipped'] as $action) {
            $this->postJson("/api/orders/{$orderId}/actions/{$action}")->assertOk();
        }

        $this->postJson("/api/admin/orders/{$orderId}/return")
            ->assertOk()
            ->assertJsonPath('data.fulfillment_status', 'returned');
    }

    public function test_return_rejects_order_not_in_shipped_or_delivered_status(): void
    {
        $variant = $this->createPurchasableVariant();
        ['order_id' => $orderId] = $this->createPaidCardOrder($variant);

        $this->makeAdmin();

        $this->postJson("/api/orders/{$orderId}/actions/markProcessing")->assertOk();

        $this->postJson("/api/admin/orders/{$orderId}/return")
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['return']);
    }

    public function test_return_is_forbidden_for_non_admin(): void
    {
        $variant = $this->createPurchasableVariant();
        $orderId = $this->postJson('/api/checkout/place-order', $this->checkoutPayload($variant))->json('order.id');

        $user = User::factory()->create();
        Role::findOrCreate('customer', 'web');
        $user->assignRole('customer');
        Sanctum::actingAs($user);

        $this->postJson("/api/admin/orders/{$orderId}/return")->assertForbidden();
    }

    public function test_admin_order_resource_formats_total_as_dollars_without_currency_code(): void
    {
        $variant = $this->createPurchasableVariant();
        $orderId = $this->postJson('/api/checkout/place-order', $this->checkoutPayload($variant))->json('order.id');

        $this->makeAdmin();

        $formattedTotal = $this->getJson("/api/admin/orders/{$orderId}")
            ->assertOk()
            ->json('data.total.formatted');

        $this->assertMatchesRegularExpression('/^\$\d+\.\d{2}$/', $formattedTotal);
    }

    public function test_admin_order_resource_exposes_nullable_attribution_and_fraud_metadata(): void
    {
        $variant = $this->createPurchasableVariant();
        $orderId = $this->postJson('/api/checkout/place-order', $this->checkoutPayload($variant))->json('order.id');
        $this->makeAdmin();

        $order = Order::query()->findOrFail($orderId);
        $meta = (array) $order->meta;
        unset($meta['attribution_origin'], $meta['attribution_device_type'], $meta['attribution_session_page_views'], $meta['fraud_risk_level'], $meta['fraud_risk_score'], $meta['fraud_seller_message']);
        $order->update(['meta' => $meta]);

        $this->getJson("/api/admin/orders/{$orderId}")
            ->assertOk()
            ->assertJsonPath('data.attribution_origin', null)
            ->assertJsonPath('data.attribution_device_type', null)
            ->assertJsonPath('data.attribution_session_page_views', null)
            ->assertJsonPath('data.fraud_risk_level', null)
            ->assertJsonPath('data.fraud_risk_score', null)
            ->assertJsonPath('data.fraud_seller_message', null);

        $order = Order::query()->findOrFail($orderId);
        $order->update(['meta' => array_merge((array) $order->meta, [
            'attribution_origin' => 'newsletter',
            'attribution_device_type' => 'mobile',
            'attribution_session_page_views' => 4,
            'fraud_risk_level' => 'highest',
            'fraud_risk_score' => 91,
            'fraud_seller_message' => 'Review before fulfillment',
        ])]);

        $this->getJson("/api/admin/orders/{$orderId}")
            ->assertOk()
            ->assertJsonPath('data.attribution_origin', 'newsletter')
            ->assertJsonPath('data.attribution_device_type', 'mobile')
            ->assertJsonPath('data.attribution_session_page_views', 4)
            ->assertJsonPath('data.fraud_risk_level', 'highest')
            ->assertJsonPath('data.fraud_risk_score', 91)
            ->assertJsonPath('data.fraud_seller_message', 'Review before fulfillment');
    }

    public function test_admin_order_aliases_filter_by_status_and_return_order_data(): void
    {
        $variant = $this->createPurchasableVariant();
        $awaitingPayment = $this->postJson('/api/checkout/place-order', $this->checkoutPayload($variant));
        $processing = $this->postJson('/api/checkout/place-order', $this->checkoutPayload($variant));
        Order::query()->findOrFail($processing->json('order.id'))->update(['status' => 'processing']);

        $this->makeAdmin();

        $this->getJson('/api/admin/orders?status=awaiting-payment')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $awaitingPayment->json('order.id'))
            ->assertJsonPath('data.0.status', 'awaiting-payment');

        $this->getJson('/api/admin/orders/'.$awaitingPayment->json('order.id'))
            ->assertOk()
            ->assertJsonPath('data.id', $awaitingPayment->json('order.id'));
    }

    public function test_order_status_label_is_a_human_readable_translation_not_the_raw_slug(): void
    {
        $variant = $this->createPurchasableVariant();
        $order = $this->postJson('/api/checkout/place-order', $this->checkoutPayload($variant));
        Order::query()->findOrFail($order->json('order.id'))->update(['status' => 'awaiting-payment']);

        $this->makeAdmin();

        $this->getJson('/api/admin/orders/'.$order->json('order.id'))
            ->assertOk()
            ->assertJsonPath('data.status', 'awaiting-payment')
            ->assertJsonPath('data.status_label', 'Awaiting Payment');

        $this->withSession(['locale' => 'vi'])
            ->getJson('/api/admin/orders/'.$order->json('order.id'))
            ->assertOk()
            ->assertJsonPath('data.status_label', 'Chờ thanh toán');
    }

    public function test_admin_order_listing_rejects_unknown_status_filter(): void
    {
        $this->makeAdmin();

        $this->getJson('/api/admin/orders?status=not-a-status')
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['status']);
    }

    public function test_customer_order_status_filter_keeps_owner_scoping(): void
    {
        $variant = $this->createPurchasableVariant();
        $owner = User::factory()->create();
        Sanctum::actingAs($owner);
        $ownedOrder = $this->postJson('/api/checkout/place-order', $this->checkoutPayload($variant));

        $otherCustomer = User::factory()->create();
        Sanctum::actingAs($otherCustomer);
        $otherOrder = $this->postJson('/api/checkout/place-order', $this->checkoutPayload($variant));

        Sanctum::actingAs($owner);

        $this->getJson('/api/orders?status=awaiting-payment')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $ownedOrder->json('order.id'))
            ->assertJsonMissing(['id' => $otherOrder->json('order.id')]);
    }

    public function test_order_manager_and_support_can_create_manual_orders_but_product_manager_cannot(): void
    {
        $variant = $this->createPurchasableVariant();

        foreach (['Order Manager', 'Support'] as $role) {
            Sanctum::actingAs($this->userWithRole($role));

            $this->postJson('/api/admin/orders', $this->manualOrderPayload($variant))
                ->assertCreated()
                ->assertJsonPath('data.status', 'awaiting-payment');
        }

        Sanctum::actingAs($this->userWithRole('Product Manager'));
        $this->postJson('/api/admin/orders', $this->manualOrderPayload($variant))
            ->assertForbidden();
    }

    public function test_manual_order_requires_the_filament_parity_fields_and_valid_choices(): void
    {
        $variant = $this->createPurchasableVariant();
        Sanctum::actingAs($this->makeAdmin());

        $missingItems = $this->manualOrderPayload($variant);
        $missingItems['items'] = [];

        $invalidPayloads = [
            'items' => $missingItems,
            'email' => array_replace_recursive($this->manualOrderPayload($variant), ['email' => null]),
            'shipping.first_name' => array_replace_recursive($this->manualOrderPayload($variant), ['shipping' => ['first_name' => null]]),
            'shipping.line_one' => array_replace_recursive($this->manualOrderPayload($variant), ['shipping' => ['line_one' => null]]),
            'shipping.city' => array_replace_recursive($this->manualOrderPayload($variant), ['shipping' => ['city' => null]]),
            'payment_method' => array_replace_recursive($this->manualOrderPayload($variant), ['payment_method' => 'paypal']),
            'shipping_method' => array_replace_recursive($this->manualOrderPayload($variant), ['shipping_method' => 'overnight']),
            'items.0.quantity' => array_replace_recursive($this->manualOrderPayload($variant), ['items' => [['quantity' => 0]]]),
            'billing.first_name' => array_replace_recursive($this->manualOrderPayload($variant), [
                'billing_same_as_shipping' => false,
                'billing' => [],
            ]),
        ];

        foreach ($invalidPayloads as $field => $payload) {
            $this->postJson('/api/admin/orders', $payload)
                ->assertUnprocessable()
                ->assertJsonValidationErrors([$field]);
        }

        $this->postJson('/api/admin/orders', array_replace_recursive($this->manualOrderPayload($variant), [
            'items' => [['quantity' => -1]],
        ]))->assertUnprocessable()->assertJsonValidationErrors(['items.0.quantity']);
    }

    public function test_manual_card_order_forces_admin_flag_when_calling_checkout_service(): void
    {
        $variant = $this->createPurchasableVariant();
        $existingOrder = Order::query()->findOrFail(
            $this->postJson('/api/checkout/place-order', $this->checkoutPayload($variant))->json('order.id'),
        );
        $admin = $this->makeAdmin();

        $checkoutService = \Mockery::mock(CheckoutService::class);
        $checkoutService->shouldReceive('placeOrder')
            ->once()
            ->with(\Mockery::on(function (array $payload) use ($variant): bool {
                return $payload['created_by_admin'] === true
                    && $payload['payment_method'] === 'card'
                    && $payload['items'][0] === ['variantId' => $variant->id, 'quantity' => 1];
            }), $admin->id, '127.0.0.1')
            ->andReturn($existingOrder);
        app()->instance(CheckoutService::class, $checkoutService);

        $this->postJson('/api/admin/orders', $this->manualOrderPayload($variant, [
            'payment_method' => 'card',
            'created_by_admin' => false,
        ]))->assertCreated()->assertJsonPath('data.id', (string) $existingOrder->id);
    }

    public function test_manual_order_uses_server_shipping_rate_unless_a_non_null_override_is_supplied(): void
    {
        $variant = $this->createPurchasableVariant();
        Sanctum::actingAs($this->makeAdmin());

        $omitted = $this->postJson('/api/admin/orders', $this->manualOrderPayload($variant, [
            'shipping_method' => 'express',
        ]));
        $omitted->assertCreated();

        $null = $this->postJson('/api/admin/orders', $this->manualOrderPayload($variant, [
            'shipping_method' => 'express',
            'shipping_fee_override' => null,
        ]));
        $null->assertCreated();

        $blank = $this->postJson('/api/admin/orders', $this->manualOrderPayload($variant, [
            'shipping_method' => 'express',
            'shipping_fee_override' => '',
        ]));
        $blank->assertCreated();

        $zero = $this->postJson('/api/admin/orders', $this->manualOrderPayload($variant, [
            'shipping_method' => 'express',
            'shipping_fee_override' => 0,
        ]));
        $zero->assertCreated();

        $positive = $this->postJson('/api/admin/orders', $this->manualOrderPayload($variant, [
            'shipping_method' => 'express',
            'shipping_fee_override' => 12.34,
        ]));
        $positive->assertCreated();

        $this->assertSame(2500, (int) Order::query()->findOrFail($omitted->json('data.id'))->shipping_total->value);
        $this->assertSame(2500, (int) Order::query()->findOrFail($null->json('data.id'))->shipping_total->value);
        $this->assertSame(2500, (int) Order::query()->findOrFail($blank->json('data.id'))->shipping_total->value);
        $this->assertSame(0, (int) Order::query()->findOrFail($zero->json('data.id'))->shipping_total->value);
        $this->assertSame(1234, (int) Order::query()->findOrFail($positive->json('data.id'))->shipping_total->value);
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

    private function userWithRole(string $role): User
    {
        Role::findOrCreate($role, 'web');
        $user = User::factory()->create();
        $user->assignRole($role);

        return $user;
    }

    private function manualOrderPayload(ProductVariant $variant, array $overrides = []): array
    {
        return array_replace_recursive([
            'items' => [[
                'variant_id' => $variant->id,
                'quantity' => 1,
            ]],
            'email' => 'manual@petposture.com',
            'shipping' => [
                'first_name' => 'Manual',
                'last_name' => 'Customer',
                'line_one' => '123 Congress Ave',
                'line_two' => null,
                'city' => 'Austin',
                'state' => 'TX',
                'postcode' => '78701',
                'country' => 'US',
                'phone' => '5125550101',
            ],
            'billing_same_as_shipping' => true,
            'payment_method' => 'cod',
            'shipping_method' => 'standard',
        ], $overrides);
    }

    /**
     * Place a COD order and directly set it to payment-received with a fake Stripe intent.
     * Avoids card checkout flow (which requires full Stripe/Lunar config in tests).
     *
     * @return array{order_id: int, intent_id: string, reference: string}
     */
    private function createPaidCardOrder(ProductVariant $variant): array
    {
        $orderResponse = $this->postJson('/api/checkout/place-order', $this->checkoutPayload($variant));
        $orderResponse->assertCreated();

        $orderId = $orderResponse->json('order.id');
        $intentId = 'pi_test_'.Str::lower(Str::random(12));

        $order = Order::find($orderId);
        $meta = (array) ($order->meta ?? []);
        $meta['payment_intent_id'] = $intentId;
        $meta['payment_status'] = 'paid';
        $order->update([
            'status' => 'payment-received',
            'meta' => $meta,
        ]);

        return [
            'order_id' => $orderId,
            'intent_id' => $intentId,
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
