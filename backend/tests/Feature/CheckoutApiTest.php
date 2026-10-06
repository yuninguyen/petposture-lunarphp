<?php

namespace Tests\Feature;

use App\Models\CheckoutSession;
use App\Models\Setting;
use App\Models\ShippingMethod;
use App\Models\StripeWebhookEvent;
use App\Models\User;
use App\Models\UserAddress;
use App\Services\CheckoutService;
use App\Services\OrderOperationsService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
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
use PHPUnit\Framework\Attributes\DataProvider;
use Spatie\Activitylog\Models\Activity;
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

    public function test_place_order_stores_contact_phone_on_different_billing_address(): void
    {
        $variant = $this->createPurchasableVariant();
        $payload = $this->checkoutPayload($variant, [
            'billing_same_as_shipping' => false,
            'billing' => [
                'first_name' => 'John',
                'last_name' => 'Doe',
                'company' => null,
                'line_one' => '456 Billing St',
                'line_two' => null,
                'city' => 'Dallas',
                'state' => 'TX',
                'postcode' => '75201',
                'country' => 'United States',
                'phone' => '5125550101',
            ],
        ]);

        $response = $this->postJson('/api/checkout/place-order', $payload);

        $response->assertCreated();
        $order = Order::query()->findOrFail($response->json('order.id'));
        $this->assertNotSame($order->shippingAddress?->id, $order->billingAddress?->id);
        $this->assertSame('456 Billing St', $order->billingAddress?->line_one);
        $this->assertSame('5125550101', $order->billingAddress?->contact_phone);
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
            ->assertJsonPath('methods.2.method', 'paypal')
            ->assertJsonPath('methods.2.environment', 'sandbox');
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
        $trackedOrderResponse->assertJsonPath('data.refund_status', null);
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

    public function test_customer_order_index_is_owner_scoped_and_excludes_staff_only_fields(): void
    {
        $variant = $this->createPurchasableVariant();
        $owner = User::factory()->create(['email' => 'owner-boundary@petposture.test']);
        Sanctum::actingAs($owner);
        $ownedOrderResponse = $this->postJson('/api/checkout/place-order', $this->checkoutPayload($variant, [
            'shipping' => ['email' => $owner->email],
        ]));
        $ownedOrder = Order::query()->findOrFail($ownedOrderResponse->json('order.id'));
        $ownedOrder->update([
            'notes' => 'CUSTOMER-NOTE-MUST-NOT-LEAK',
            'meta' => array_merge((array) $ownedOrder->meta, [
                'internal_note' => 'INTERNAL-NOTE-MUST-NOT-LEAK',
                'customer_note' => 'CUSTOMER-NOTE-MUST-NOT-LEAK',
                'fraud_risk_level' => 'highest',
                'fraud_risk_score' => 99,
                'fraud_seller_message' => 'FRAUD-MESSAGE-MUST-NOT-LEAK',
                'customer_ip' => '203.0.113.42',
                'customer_ip_location' => 'SECURITY-TEST-LOCATION',
                'customer_ip_isp' => 'SECURITY-TEST-ISP',
                'customer_user_agent' => 'SECURITY-TEST-DEVICE',
                'customer_ip_service_type' => 'SECURITY-TEST-SERVICE',
                'attribution_origin' => 'SECURITY-TEST-ORIGIN',
                'attribution_device_type' => 'SECURITY-TEST-ATTRIBUTION-DEVICE',
                'attribution_session_page_views' => 987,
                'payment_intent_id' => 'pi_SECURITY_BOUNDARY',
                'payment_intent_status' => 'requires_review',
                'payment_last_event_type' => 'payment_intent.security_boundary',
                'payment_gateway' => 'SECURITY-TEST-GATEWAY',
                'payment_collection' => 'SECURITY-TEST-COLLECTION',
                'refund_id' => 're_SECURITY_BOUNDARY',
                'refund_amount' => 4242,
                'card_funding' => 'SECURITY-TEST-FUNDING',
                'paypal_payer_email' => 'payer-boundary@petposture.test',
                'payment_status' => 'paid',
                'delivered_at' => '2026-09-06T10:30:00+00:00',
                'shipments' => [[
                    'tracking_number' => '1Z-CUSTOMER-BOUNDARY',
                    'carrier' => 'ups',
                    'tracking_url' => 'https://www.ups.com/track?tracknum=1Z-CUSTOMER-BOUNDARY',
                    'status' => 'delivered',
                    'provider_response' => ['raw' => 'INDEX-PROVIDER-RESPONSE-MUST-NOT-LEAK'],
                    'label_id' => 'INDEX-LABEL-ID-MUST-NOT-LEAK',
                    'internal_cost' => 1234,
                    'payment_gateway' => 'INDEX-PAYMENT-GATEWAY-MUST-NOT-LEAK',
                    'refund_id' => 'INDEX-REFUND-ID-MUST-NOT-LEAK',
                ]],
            ]),
            'status' => 'delivered',
        ]);

        $otherCustomer = User::factory()->create(['email' => 'other-boundary@petposture.test']);
        Sanctum::actingAs($otherCustomer);
        $otherOrderResponse = $this->postJson('/api/checkout/place-order', $this->checkoutPayload($variant, [
            'shipping' => ['email' => $otherCustomer->email],
        ]));

        Sanctum::actingAs($owner);
        $response = $this->getJson('/api/orders');

        $response->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', (string) $ownedOrder->id)
            ->assertJsonMissing(['id' => $otherOrderResponse->json('order.id')])
            ->assertJsonPath('meta.current_page', 1)
            ->assertJsonPath('meta.per_page', 10)
            ->assertJsonPath('meta.total', 1)
            ->assertJsonPath('data.0.status', 'delivered')
            ->assertJsonPath('data.0.status_label', 'Delivered')
            ->assertJsonPath('data.0.payment_status', 'paid')
            ->assertJsonPath('data.0.payment_status_label', 'Paid')
            ->assertJsonPath('data.0.fulfillment_status', 'delivered')
            ->assertJsonPath('data.0.fulfillment_status_label', 'Delivered')
            ->assertJsonPath('data.0.customer_email', $owner->email)
            ->assertJsonPath('data.0.payment_method', 'cod')
            ->assertJsonPath('data.0.payment_label', 'Cash on delivery')
            ->assertJsonPath('data.0.payment_instructions', 'Collect payment when the shipment is delivered.')
            ->assertJsonPath('data.0.shipping_label', 'Standard')
            ->assertJsonPath('data.0.delivered_at', '2026-09-06T10:30:00+00:00')
            ->assertJsonPath('data.0.currency', 'USD')
            ->assertJsonPath('data.0.lines.0.description', 'Test Pet Bed')
            ->assertJsonPath('data.0.lines.0.image', '/assets/Pug-Dog-Bed.jpg')
            ->assertJsonPath('data.0.shipping_address.first_name', 'Jane')
            ->assertJsonPath('data.0.shipping_address.line_one', '123 Congress Ave')
            ->assertJsonPath('data.0.shipping_address.city', 'Austin')
            ->assertJsonPath('data.0.shipping_address.state', 'TX')
            ->assertJsonPath('data.0.shipping_address.postcode', '78701')
            ->assertJsonPath('data.0.shipping_address.country', 'United States')
            ->assertJsonPath('data.0.shipping_address.phone', '5125550101')
            ->assertJsonPath('data.0.billing_address.first_name', 'Jane')
            ->assertJsonPath('data.0.billing_address.line_one', '123 Congress Ave')
            ->assertJsonPath('data.0.shipments.0.tracking_number', '1Z-CUSTOMER-BOUNDARY')
            ->assertJsonPath('data.0.shipments.0.carrier', 'ups')
            ->assertJsonPath('data.0.shipments.0.tracking_url', 'https://www.ups.com/track?tracknum=1Z-CUSTOMER-BOUNDARY')
            ->assertJsonPath('data.0.shipments.0.status', 'delivered');

        foreach ([
            'internal_note', 'notes', 'customer_note',
            'available_actions', 'remaining_shippable_quantities', 'refund_reason_options',
            'order_events',
            'fraud_risk_level', 'fraud_risk_score', 'fraud_seller_message',
            'customer_ip', 'customer_ip_location', 'customer_ip_isp',
            'customer_user_agent', 'customer_ip_service_type',
            'attribution_origin', 'attribution_device_type', 'attribution_session_page_views',
            'payment_intent_id', 'payment_intent_status', 'payment_last_event_type',
            'payment_gateway', 'payment_collection',
            'refund_id', 'refund_amount',
            'card_funding', 'paypal_payer_email',
        ] as $path) {
            $response->assertJsonMissingPath("data.0.{$path}");
        }
        foreach (['provider_response', 'label_id', 'internal_cost', 'payment_gateway', 'refund_id'] as $path) {
            $response->assertJsonMissingPath("data.0.shipments.0.{$path}");
        }

        $lineKeys = array_keys($response->json('data.0.lines.0'));
        sort($lineKeys);
        $this->assertSame([
            'description', 'discount_total', 'id', 'image', 'quantity', 'sub_total',
            'tax_total', 'total', 'type', 'unit_price', 'variant_label',
        ], $lineKeys);
        $shippingAddressKeys = array_keys($response->json('data.0.shipping_address'));
        sort($shippingAddressKeys);
        $this->assertSame([
            'city', 'country', 'first_name', 'last_name', 'line_one', 'line_two', 'phone',
            'postcode', 'state',
        ], $shippingAddressKeys);
        $billingAddressKeys = array_keys($response->json('data.0.billing_address'));
        sort($billingAddressKeys);
        $this->assertSame([
            'city', 'country', 'first_name', 'last_name', 'line_one', 'line_two', 'phone',
            'postcode', 'state',
        ], $billingAddressKeys);
        $shipmentKeys = array_keys($response->json('data.0.shipments.0'));
        sort($shipmentKeys);
        $this->assertSame(['carrier', 'id', 'status', 'tracking_number', 'tracking_url'], $shipmentKeys);
        $orderKeys = array_keys($response->json('data.0'));
        sort($orderKeys);
        $this->assertSame([
            'billing_address', 'created_at', 'currency', 'customer_email', 'delivered_at',
            'discount_total', 'fulfillment_status', 'fulfillment_status_label', 'id', 'lines',
            'payment_instructions', 'payment_label', 'payment_method', 'payment_status',
            'payment_status_label', 'reference', 'shipments', 'shipping_address', 'shipping_label',
            'shipping_total', 'status', 'status_label', 'sub_total', 'tax_total', 'total',
        ], $orderKeys);
        $totalKeys = array_keys($response->json('data.0.total'));
        sort($totalKeys);
        $this->assertSame(['currency', 'decimal', 'formatted'], $totalKeys);
    }

    public function test_customer_order_show_falls_back_to_shipping_phone_without_mutating_billing_address(): void
    {
        $variant = $this->createPurchasableVariant();
        $owner = User::factory()->create(['email' => 'phone-fallback@petposture.test']);
        Sanctum::actingAs($owner);

        $orderResponse = $this->postJson('/api/checkout/place-order', $this->checkoutPayload($variant, [
            'shipping' => ['email' => $owner->email, 'phone' => '5125550101'],
            'billing_same_as_shipping' => false,
            'billing' => [
                'first_name' => 'Billing',
                'last_name' => 'Customer',
                'company' => null,
                'line_one' => '456 Billing St',
                'line_two' => null,
                'city' => 'Dallas',
                'state' => 'TX',
                'postcode' => '75201',
                'country' => 'United States',
                'phone' => null,
            ],
        ]));
        $order = Order::query()->findOrFail($orderResponse->json('order.id'));
        $billingAddress = $order->billingAddress;
        $shippingAddress = $order->shippingAddress;
        $billingBefore = $billingAddress?->getAttributes();
        $shippingBefore = $shippingAddress?->getAttributes();

        $this->getJson("/api/orders/{$order->id}")
            ->assertOk()
            ->assertJsonPath('data.billing_address.phone', '5125550101');

        $this->assertSame($billingBefore, $billingAddress?->fresh()?->getAttributes());
        $this->assertSame($shippingBefore, $shippingAddress?->fresh()?->getAttributes());
    }

    public function test_customer_order_show_returns_safe_owner_contract_and_hides_other_customers_order(): void
    {
        $variant = $this->createPurchasableVariant();
        $owner = User::factory()->create(['email' => 'show-owner@petposture.test']);
        Sanctum::actingAs($owner);
        $orderResponse = $this->postJson('/api/checkout/place-order', $this->checkoutPayload($variant, [
            'shipping' => ['email' => $owner->email],
        ]));
        $order = Order::query()->findOrFail($orderResponse->json('order.id'));
        $order->update([
            'notes' => 'SHOW-CUSTOMER-NOTE-MUST-NOT-LEAK',
            'meta' => array_merge((array) $order->meta, [
                'internal_note' => 'SHOW-INTERNAL-NOTE-MUST-NOT-LEAK',
                'customer_note' => 'SHOW-CUSTOMER-NOTE-MUST-NOT-LEAK',
                'fraud_risk_level' => 'highest',
                'fraud_risk_score' => 98,
                'fraud_seller_message' => 'SHOW-FRAUD-MESSAGE-MUST-NOT-LEAK',
                'customer_ip' => '198.51.100.24',
                'customer_ip_location' => 'SHOW-SECURITY-TEST-LOCATION',
                'customer_ip_isp' => 'SHOW-SECURITY-TEST-ISP',
                'customer_user_agent' => 'SHOW-SECURITY-TEST-DEVICE',
                'customer_ip_service_type' => 'SHOW-SECURITY-TEST-SERVICE',
                'attribution_origin' => 'SHOW-SECURITY-TEST-ORIGIN',
                'attribution_device_type' => 'SHOW-SECURITY-TEST-ATTRIBUTION-DEVICE',
                'attribution_session_page_views' => 986,
                'payment_intent_id' => 'pi_SHOW_SECURITY_BOUNDARY',
                'payment_intent_status' => 'requires_review',
                'payment_last_event_type' => 'payment_intent.show_security_boundary',
                'payment_gateway' => 'SHOW-SECURITY-TEST-GATEWAY',
                'payment_collection' => 'SHOW-SECURITY-TEST-COLLECTION',
                'refund_id' => 're_SHOW_SECURITY_BOUNDARY',
                'refund_amount' => 4343,
                'card_funding' => 'SHOW-SECURITY-TEST-FUNDING',
                'paypal_payer_email' => 'show-payer-boundary@petposture.test',
                'payment_status' => 'paid',
                'delivered_at' => '2026-09-06T11:45:00+00:00',
                'shipments' => [[
                    'tracking_number' => '9400-SHOW-BOUNDARY',
                    'carrier' => 'usps',
                    'tracking_url' => 'https://tools.usps.com/go/TrackConfirmAction?qtc_tLabels1=9400-SHOW-BOUNDARY',
                    'status' => 'delivered',
                    'provider_response' => ['raw' => 'SHOW-PROVIDER-RESPONSE-MUST-NOT-LEAK'],
                    'label_id' => 'SHOW-LABEL-ID-MUST-NOT-LEAK',
                    'internal_cost' => 5678,
                    'payment_gateway' => 'SHOW-PAYMENT-GATEWAY-MUST-NOT-LEAK',
                    'refund_id' => 'SHOW-REFUND-ID-MUST-NOT-LEAK',
                ]],
            ]),
            'status' => 'delivered',
        ]);

        $response = $this->getJson("/api/orders/{$order->id}");

        $response->assertOk()
            ->assertJsonPath('data.id', (string) $order->id)
            ->assertJsonPath('data.status', 'delivered')
            ->assertJsonPath('data.status_label', 'Delivered')
            ->assertJsonPath('data.payment_status', 'paid')
            ->assertJsonPath('data.payment_status_label', 'Paid')
            ->assertJsonPath('data.fulfillment_status', 'delivered')
            ->assertJsonPath('data.fulfillment_status_label', 'Delivered')
            ->assertJsonPath('data.customer_email', $owner->email)
            ->assertJsonPath('data.payment_method', 'cod')
            ->assertJsonPath('data.payment_label', 'Cash on delivery')
            ->assertJsonPath('data.payment_instructions', 'Collect payment when the shipment is delivered.')
            ->assertJsonPath('data.shipping_label', 'Standard')
            ->assertJsonPath('data.delivered_at', '2026-09-06T11:45:00+00:00')
            ->assertJsonPath('data.currency', 'USD')
            ->assertJsonPath('data.lines.0.description', 'Test Pet Bed')
            ->assertJsonPath('data.lines.0.image', '/assets/Pug-Dog-Bed.jpg')
            ->assertJsonPath('data.shipping_address.first_name', 'Jane')
            ->assertJsonPath('data.shipping_address.last_name', 'Doe')
            ->assertJsonPath('data.shipping_address.line_one', '123 Congress Ave')
            ->assertJsonPath('data.shipping_address.line_two', 'Unit 4B')
            ->assertJsonPath('data.shipping_address.city', 'Austin')
            ->assertJsonPath('data.shipping_address.state', 'TX')
            ->assertJsonPath('data.shipping_address.postcode', '78701')
            ->assertJsonPath('data.shipping_address.country', 'United States')
            ->assertJsonPath('data.shipping_address.phone', '5125550101')
            ->assertJsonPath('data.billing_address.first_name', 'Jane')
            ->assertJsonPath('data.billing_address.last_name', 'Doe')
            ->assertJsonPath('data.billing_address.line_one', '123 Congress Ave')
            ->assertJsonPath('data.billing_address.city', 'Austin')
            ->assertJsonPath('data.shipments.0.tracking_number', '9400-SHOW-BOUNDARY')
            ->assertJsonPath('data.shipments.0.carrier', 'usps')
            ->assertJsonPath('data.shipments.0.tracking_url', 'https://tools.usps.com/go/TrackConfirmAction?qtc_tLabels1=9400-SHOW-BOUNDARY')
            ->assertJsonPath('data.shipments.0.status', 'delivered');

        foreach ([
            'internal_note', 'notes', 'customer_note',
            'available_actions', 'remaining_shippable_quantities', 'refund_reason_options',
            'order_events',
            'fraud_risk_level', 'fraud_risk_score', 'fraud_seller_message',
            'customer_ip', 'customer_ip_location', 'customer_ip_isp',
            'customer_user_agent', 'customer_ip_service_type',
            'attribution_origin', 'attribution_device_type', 'attribution_session_page_views',
            'payment_intent_id', 'payment_intent_status', 'payment_last_event_type',
            'payment_gateway', 'payment_collection',
            'refund_id', 'refund_amount',
            'card_funding', 'paypal_payer_email',
        ] as $path) {
            $response->assertJsonMissingPath("data.{$path}");
        }
        foreach (['provider_response', 'label_id', 'internal_cost', 'payment_gateway', 'refund_id'] as $path) {
            $response->assertJsonMissingPath("data.shipments.0.{$path}");
        }

        $lineKeys = array_keys($response->json('data.lines.0'));
        sort($lineKeys);
        $this->assertSame([
            'description', 'discount_total', 'id', 'image', 'quantity', 'sub_total',
            'tax_total', 'total', 'type', 'unit_price', 'variant_label',
        ], $lineKeys);
        $shippingAddressKeys = array_keys($response->json('data.shipping_address'));
        sort($shippingAddressKeys);
        $this->assertSame([
            'city', 'country', 'first_name', 'last_name', 'line_one', 'line_two', 'phone',
            'postcode', 'state',
        ], $shippingAddressKeys);
        $billingAddressKeys = array_keys($response->json('data.billing_address'));
        sort($billingAddressKeys);
        $this->assertSame([
            'city', 'country', 'first_name', 'last_name', 'line_one', 'line_two', 'phone',
            'postcode', 'state',
        ], $billingAddressKeys);
        $shipmentKeys = array_keys($response->json('data.shipments.0'));
        sort($shipmentKeys);
        $this->assertSame(['carrier', 'id', 'status', 'tracking_number', 'tracking_url'], $shipmentKeys);
        $orderKeys = array_keys($response->json('data'));
        sort($orderKeys);
        $this->assertSame([
            'billing_address', 'created_at', 'currency', 'customer_email', 'delivered_at',
            'discount_total', 'fulfillment_status', 'fulfillment_status_label', 'id', 'lines',
            'payment_instructions', 'payment_label', 'payment_method', 'payment_status',
            'payment_status_label', 'reference', 'shipments', 'shipping_address', 'shipping_label',
            'shipping_total', 'status', 'status_label', 'sub_total', 'tax_total', 'total',
        ], $orderKeys);
        $totalKeys = array_keys($response->json('data.total'));
        sort($totalKeys);
        $this->assertSame(['currency', 'decimal', 'formatted'], $totalKeys);

        $otherCustomer = User::factory()->create();
        Sanctum::actingAs($otherCustomer);
        $this->getJson("/api/orders/{$order->id}")
            ->assertNotFound()
            ->assertJsonPath('message', 'Order not found');
    }

    public function test_admin_order_show_preserves_staff_rich_contract(): void
    {
        $variant = $this->createPurchasableVariant();
        $orderId = $this->postJson('/api/checkout/place-order', $this->checkoutPayload($variant))->json('order.id');
        $order = Order::query()->findOrFail($orderId);
        $order->update(['meta' => array_merge((array) $order->meta, [
            'internal_note' => 'ADMIN-INTERNAL-NOTE',
            'fraud_risk_score' => 97,
            'customer_ip' => '192.0.2.18',
            'payment_intent_id' => 'pi_ADMIN_SECURITY_BOUNDARY',
        ])]);
        $this->makeAdmin();

        $this->getJson("/api/admin/orders/{$orderId}")
            ->assertOk()
            ->assertJsonPath('data.internal_note', 'ADMIN-INTERNAL-NOTE')
            ->assertJsonPath('data.fraud_risk_score', 97)
            ->assertJsonPath('data.customer_ip', '192.0.2.18')
            ->assertJsonPath('data.payment_intent_id', 'pi_ADMIN_SECURITY_BOUNDARY')
            ->assertJsonStructure(['data' => ['available_actions']]);
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

    public function test_stock_is_decremented_once_when_order_reaches_payment_received_or_processing(): void
    {
        $variant = $this->createPurchasableVariant();
        $this->makeAdmin();
        $order = Order::query()->findOrFail(
            $this->postJson('/api/admin/orders', $this->manualOrderPayload($variant, ['payment_method' => 'cod']))
                ->assertCreated()
                ->json('data.id'),
        );
        $this->assertSame('awaiting-payment', $order->status);
        $this->assertSame(25, $variant->fresh()->stock);

        $order->update(['status' => 'payment-received']);
        $this->assertSame(24, $variant->fresh()->stock);

        // Moving on to processing must not decrement a second time.
        $order->update(['status' => 'processing']);
        $this->assertSame(24, $variant->fresh()->stock);
    }

    public function test_stock_is_restored_when_a_reduced_order_is_cancelled(): void
    {
        $variant = $this->createPurchasableVariant();
        $this->makeAdmin();
        $order = Order::query()->findOrFail(
            $this->postJson('/api/admin/orders', $this->manualOrderPayload($variant, ['payment_method' => 'cod']))
                ->assertCreated()
                ->json('data.id'),
        );

        $order->update(['status' => 'processing']);
        $this->assertSame(24, $variant->fresh()->stock);

        $order->update(['status' => 'cancelled']);
        $this->assertSame(25, $variant->fresh()->stock);
    }

    public function test_stock_is_not_restored_when_cancelling_before_any_reduction_happened(): void
    {
        $variant = $this->createPurchasableVariant();
        $this->makeAdmin();
        $order = Order::query()->findOrFail(
            $this->postJson('/api/admin/orders', $this->manualOrderPayload($variant, ['payment_method' => 'cod']))
                ->assertCreated()
                ->json('data.id'),
        );
        $this->assertSame('awaiting-payment', $order->status);

        $order->update(['status' => 'cancelled']);

        $this->assertSame(25, $variant->fresh()->stock);
    }

    public function test_shipping_line_is_never_treated_as_an_inventory_line(): void
    {
        $variant = $this->createPurchasableVariant();
        $this->makeAdmin();
        $order = Order::query()->findOrFail(
            $this->postJson('/api/admin/orders', $this->manualOrderPayload($variant, ['payment_method' => 'cod']))
                ->assertCreated()
                ->json('data.id'),
        );
        $order->loadMissing('lines');
        $this->assertTrue($order->lines->contains('type', 'shipping'));

        $order->update(['status' => 'payment-received']);

        // Only the physical line's quantity (1) came off stock, not the shipping line too.
        $this->assertSame(24, $variant->fresh()->stock);
    }

    public function test_stock_never_goes_negative_and_logs_a_warning_when_insufficient(): void
    {
        $variant = $this->createPurchasableVariant();
        $this->makeAdmin();
        $order = Order::query()->findOrFail(
            $this->postJson('/api/admin/orders', $this->manualOrderPayload($variant, ['payment_method' => 'cod']))
                ->assertCreated()
                ->json('data.id'),
        );

        // Simulate a concurrent order draining stock to zero between this
        // order being placed and it reaching payment-received.
        $variant->update(['stock' => 0]);
        Log::spy();

        $order->update(['status' => 'payment-received']);

        $this->assertSame(0, $variant->fresh()->stock);
        Log::shouldHaveReceived('warning')->once()->with(
            'Insufficient product variant stock while reducing order inventory.',
            \Mockery::on(fn (array $context): bool => $context['variant_id'] === $variant->id
                && $context['sku'] === $variant->sku
                && $context['requested_quantity'] === 1
                && $context['stock_before_reduction'] === 0),
        );
    }

    public function test_order_cancellation_does_not_over_restore_a_line_that_failed_to_decrement_due_to_insufficient_stock(): void
    {
        $variantA = $this->createPurchasableVariant();
        $variantB = $this->createPurchasableVariant();
        $this->makeAdmin();

        $payload = $this->manualOrderPayload($variantA, ['payment_method' => 'cod']);
        $payload['items'] = [
            ['variant_id' => $variantA->id, 'quantity' => 1],
            ['variant_id' => $variantB->id, 'quantity' => 1],
        ];

        $order = Order::query()->findOrFail(
            $this->postJson('/api/admin/orders', $payload)->assertCreated()->json('data.id'),
        );

        $variantB->update(['stock' => 0]);

        $order->update(['status' => 'payment-received']);
        $this->assertSame(24, $variantA->fresh()->stock);
        $this->assertSame(0, $variantB->fresh()->stock);

        $order->update(['status' => 'cancelled']);
        $this->assertSame(25, $variantA->fresh()->stock);

        // Variant B never lost stock, so cancellation must not credit it either.
        $this->assertSame(0, $variantB->fresh()->stock);
    }

    public function test_manual_order_creation_writes_an_audit_log_without_customer_data(): void
    {
        $variant = $this->createPurchasableVariant();
        $admin = $this->makeAdmin();
        Sanctum::actingAs($admin);

        $payload = $this->manualOrderPayload($variant);
        $payload['payment_method'] = 'card';

        $orderId = $this->postJson('/api/admin/orders', $payload)
            ->assertCreated()
            ->json('data.id');

        $activity = Activity::query()
            ->where('log_name', 'default')
            ->where('subject_type', (new Order)->getMorphClass())
            ->where('subject_id', $orderId)
            ->where('description', 'created')
            ->where('properties->source', 'manual')
            ->first();

        $this->assertNotNull($activity);
        $this->assertSame($admin->id, $activity->causer_id);
        $this->assertSame('manual', $activity->properties['source']);
        $this->assertSame('card', $activity->properties['payment_method']);
        $this->assertTrue($activity->properties['marked_paid']);
        $this->assertSame(count($payload['items']), $activity->properties['item_count']);
        $this->assertStringNotContainsString($payload['email'], json_encode($activity->properties));
    }

    public function test_manual_cod_order_audit_log_is_not_marked_paid(): void
    {
        $variant = $this->createPurchasableVariant();
        Sanctum::actingAs($this->makeAdmin());

        $payload = $this->manualOrderPayload($variant);
        $payload['payment_method'] = 'cod';

        $orderId = $this->postJson('/api/admin/orders', $payload)->assertCreated()->json('data.id');

        $activity = Activity::query()
            ->where('log_name', 'default')
            ->where('subject_id', $orderId)
            ->where('description', 'created')
            ->where('properties->source', 'manual')
            ->first();

        $this->assertNotNull($activity);
        $this->assertFalse($activity->properties['marked_paid']);
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

    public function test_admin_refund_calls_the_real_stripe_refund_endpoint_and_updates_order_meta(): void
    {
        $variant = $this->createPurchasableVariant();
        $paid = $this->createPaidCardOrder($variant);
        $this->makeAdmin();

        config()->set('services.stripe.secret', 'sk_test_refund_flow');
        Cache::forget('stripe_secret');
        Http::fake([
            'https://api.stripe.com/v1/refunds' => Http::response([
                'id' => 're_test_flow_1',
                'status' => 'succeeded',
                'amount' => 2500,
            ]),
        ]);

        $this->postJson("/api/admin/orders/{$paid['order_id']}/refund", [
            'amount' => 25.00,
            'reason' => 'customer_request',
        ])->assertOk()
            ->assertJsonPath('data.refund_status', 'refunded')
            ->assertJsonPath('data.payment_status', 'partially-refunded');

        Http::assertSent(fn ($request) => $request->url() === 'https://api.stripe.com/v1/refunds'
            && $request['payment_intent'] === $paid['intent_id']
            && (int) $request['amount'] === 2500);

        $order = Order::query()->findOrFail($paid['order_id']);
        $this->assertSame('re_test_flow_1', $order->meta['refund_id']);
        $this->assertSame('partially-refunded', $order->meta['payment_status']);
    }

    public function test_refunding_a_gateway_without_a_refund_implementation_is_rejected_by_name_not_misrouted_to_stripe(): void
    {
        // refundOrder() only implements Stripe, PayPal, Airwallex and Cash on Delivery. Any
        // other gateway (payoneer, pingpong, ...) must be rejected by its own name — never
        // silently fall into the Stripe branch just because it isn't PayPal. A real Payoneer
        // refund is tracked separately.
        $this->makeAdmin();

        foreach (['payoneer', 'pingpong'] as $gateway) {
            $order = Order::factory()->create([
                'status' => 'processing',
                'total' => 5000,
                'meta' => [
                    'payment_gateway' => $gateway,
                    'payment_status' => 'paid',
                ],
            ]);

            $this->postJson("/api/admin/orders/{$order->id}/refund", ['reason' => 'customer_request'])
                ->assertUnprocessable()
                ->assertJsonValidationErrors(['refund'])
                ->assertJsonFragment(['refund' => ["Refunds are not supported yet for the \"{$gateway}\" payment gateway."]]);

            $this->assertSame('paid', $order->fresh()->meta['payment_status']);
        }
    }

    private function configureAirwallex(): void
    {
        config()->set('services.airwallex.client_id', 'awx_client_test');
        config()->set('services.airwallex.api_key', 'awx_key_test');
        config()->set('services.airwallex.webhook_secret', null);
        config()->set('services.airwallex.mode', 'sandbox');
        config()->set('services.airwallex.checkout_enabled', true);
        foreach (['airwallex_client_id', 'airwallex_api_key', 'airwallex_webhook_secret', 'airwallex_mode', 'airwallex_access_token_sandbox'] as $key) {
            Cache::forget($key);
        }
    }

    public function test_airwallex_session_creates_a_payment_intent_with_return_url_session_metadata_and_shipping(): void
    {
        $this->configureAirwallex();
        Http::fake([
            'https://api-demo.airwallex.com/api/v1/authentication/login' => Http::response(['token' => 'awx_token']),
            'https://api-demo.airwallex.com/api/v1/pa/payment_intents/create' => Http::response([
                'id' => 'int_awx_1',
                'client_secret' => 'awx_secret_1',
            ], 201),
        ]);
        $variant = $this->createPurchasableVariant();

        $response = $this->postJson('/api/checkout/airwallex-session', array_replace($this->stripeAltSessionPayload($variant), ['payment_method' => 'airwallex']))
            ->assertOk()
            ->assertJsonPath('session.intent_id', 'int_awx_1')
            ->assertJsonPath('session.client_secret', 'awx_secret_1')
            ->assertJsonPath('session.env', 'demo');

        $sessionId = $response->json('session.session_id');
        $this->assertStringStartsWith('AIRWALLEX-', $sessionId);
        Http::assertSent(fn ($request): bool => str_ends_with($request->url(), '/pa/payment_intents/create')
            && $request['metadata']['session_id'] === $sessionId
            && $request['merchant_order_id'] === $sessionId
            && str_contains($request['return_url'], "gateway=airwallex&session_id={$sessionId}")
            && $request['customer']['email'] === 'guest@petposture.com'
            && $request['order']['shipping']['address']['city'] === 'Austin'
            && $request['order']['shipping']['address']['country_code'] === 'US');
    }

    public function test_airwallex_session_is_refused_until_airwallex_checkout_is_switched_on(): void
    {
        $this->configureAirwallex();
        config()->set('services.airwallex.checkout_enabled', false);
        $variant = $this->createPurchasableVariant();

        $this->postJson('/api/checkout/airwallex-session', array_replace($this->stripeAltSessionPayload($variant), ['payment_method' => 'airwallex']))
            ->assertStatus(422);
    }

    public function test_airwallex_webhook_marks_the_order_paid_by_intent_id_even_though_the_event_has_no_order_reference(): void
    {
        $this->configureAirwallex();
        $variant = $this->createPurchasableVariant();
        $placed = $this->postJson('/api/checkout/place-order', $this->checkoutPayload($variant, [
            'payment_method' => 'airwallex',
            'payment_context' => ['intent_id' => 'int_awx_paid_1', 'session_id' => 'AIRWALLEX-PAID'],
        ]));
        $placed->assertCreated();

        $this->postJson('/api/webhooks/airwallex', [
            'id' => 'evt_awx_paid_1',
            'name' => 'payment_intent.succeeded',
            'data' => ['object' => [
                'id' => 'int_awx_paid_1',
                'metadata' => ['session_id' => 'AIRWALLEX-PAID'],
                'latest_payment_attempt' => ['payment_method' => ['type' => 'card', 'card' => ['brand' => 'visa', 'last4' => '0008', 'card_type' => 'DEBIT']]],
            ]],
        ])->assertOk()->assertJsonPath('result.payment_status', 'paid');

        $order = Order::query()->findOrFail($placed->json('order.id'));
        $this->assertSame('paid', $order->meta['payment_status']);
        $this->assertSame('payment-received', $order->status);
        // Same card fields Stripe stores, so receipts show the brand and last 4 like a Stripe card order.
        $this->assertSame('visa', $order->meta['card_brand']);
        $this->assertSame('0008', $order->meta['card_last4']);
        $this->assertSame('debit', $order->meta['card_funding']);
        $this->assertSame('Card', $order->meta['payment_label']);
    }

    public function test_airwallex_failed_attempt_event_points_at_the_intent_and_marks_the_order_failed(): void
    {
        $this->configureAirwallex();
        $variant = $this->createPurchasableVariant();
        $placed = $this->postJson('/api/checkout/place-order', $this->checkoutPayload($variant, [
            'payment_method' => 'airwallex',
            'payment_context' => ['intent_id' => 'int_awx_fail_1', 'session_id' => 'AIRWALLEX-FAIL'],
        ]));
        $placed->assertCreated();

        $this->postJson('/api/webhooks/airwallex', [
            'id' => 'evt_awx_fail_1',
            'name' => 'payment_attempt.authorization_failed',
            'data' => ['object' => ['id' => 'att_1', 'payment_intent_id' => 'int_awx_fail_1']],
        ])->assertOk()->assertJsonPath('result.payment_status', 'failed');

        $this->assertSame('failed', Order::query()->findOrFail($placed->json('order.id'))->meta['payment_status']);
    }

    public function test_airwallex_google_pay_is_offered_only_with_a_merchant_id_and_its_own_switch(): void
    {
        $this->configureAirwallex();
        // The endpoint lists every method with an `enabled` flag; what is not enabled is not offered.
        $wallet = fn () => collect($this->getJson('/api/checkout/payment-methods')->json('methods'))->first(fn (array $method): bool => $method['method'] === 'airwallex_google_pay' && $method['enabled']);

        // No account id: Google Pay cannot identify the merchant, so it is not offered.
        config()->set('services.airwallex.merchant_id', null);
        $this->assertNull($wallet());

        config()->set('services.airwallex.merchant_id', 'acct_test_1');
        $this->assertSame('acct_test_1', $wallet()['merchant_id']);
        $this->assertSame('demo', $wallet()['env']);

        // Independent of the card switch...
        Setting::set('payment_method_airwallex_enabled', false, 'boolean', 'payment');
        $this->assertNotNull($wallet());

        // ...and governed by its own.
        Setting::set('payment_method_airwallex_google_pay_enabled', false, 'boolean', 'payment');
        $this->assertNull($wallet());
    }

    public function test_airwallex_google_pay_session_and_order_follow_the_wallet_switch(): void
    {
        $this->configureAirwallex();
        config()->set('services.airwallex.merchant_id', 'acct_test_1');
        Http::fake([
            'https://api-demo.airwallex.com/api/v1/authentication/login' => Http::response(['token' => 'awx_token']),
            'https://api-demo.airwallex.com/api/v1/pa/payment_intents/create' => Http::response(['id' => 'int_awx_gp_1', 'client_secret' => 'awx_secret_gp'], 201),
        ]);
        $variant = $this->createPurchasableVariant();
        Setting::set('payment_method_airwallex_enabled', false, 'boolean', 'payment');

        $this->postJson('/api/checkout/airwallex-session', array_replace($this->stripeAltSessionPayload($variant), ['payment_method' => 'airwallex', 'wallet' => 'google_pay']))
            ->assertOk()
            ->assertJsonPath('session.intent_id', 'int_awx_gp_1');

        $placed = $this->postJson('/api/checkout/place-order', $this->checkoutPayload($variant, [
            'payment_method' => 'airwallex',
            'payment_context' => ['intent_id' => 'int_awx_gp_1', 'session_id' => 'AIRWALLEX-GP', 'wallet' => 'google_pay'],
        ]))->assertCreated();
        $order = Order::query()->findOrFail($placed->json('order.id'));
        $this->assertSame('google_pay', $order->meta['payment_wallet']);
        $this->assertSame('airwallex', $order->meta['payment_gateway']);

        // The card form stays refused while its own switch is off.
        $this->postJson('/api/checkout/airwallex-session', array_replace($this->stripeAltSessionPayload($variant), ['payment_method' => 'airwallex']))
            ->assertStatus(422);

        Setting::set('payment_method_airwallex_google_pay_enabled', false, 'boolean', 'payment');
        $this->postJson('/api/checkout/airwallex-session', array_replace($this->stripeAltSessionPayload($variant), ['payment_method' => 'airwallex', 'wallet' => 'google_pay']))
            ->assertStatus(422);
        $this->postJson('/api/checkout/place-order', $this->checkoutPayload($variant, [
            'payment_method' => 'airwallex',
            'payment_context' => ['intent_id' => 'int_awx_gp_2', 'session_id' => 'AIRWALLEX-GP2', 'wallet' => 'google_pay'],
        ]))->assertStatus(422);
    }

    public function test_airwallex_apple_pay_needs_no_merchant_id_and_follows_its_own_switch(): void
    {
        $this->configureAirwallex();
        config()->set('services.airwallex.merchant_id', null);
        Http::fake([
            'https://api-demo.airwallex.com/api/v1/authentication/login' => Http::response(['token' => 'awx_token']),
            'https://api-demo.airwallex.com/api/v1/pa/payment_intents/create' => Http::response(['id' => 'int_awx_ap_1', 'client_secret' => 'awx_secret_ap'], 201),
        ]);
        $variant = $this->createPurchasableVariant();
        $wallet = fn (string $method) => collect($this->getJson('/api/checkout/payment-methods')->json('methods'))->first(fn (array $entry): bool => $entry['method'] === $method && $entry['enabled']);

        // Google Pay needs the account id, Apple Pay does not (Airwallex validates the merchant for the web itself).
        $this->assertNull($wallet('airwallex_google_pay'));
        $this->assertNotNull($wallet('airwallex_apple_pay'));

        $this->postJson('/api/checkout/airwallex-session', array_replace($this->stripeAltSessionPayload($variant), ['payment_method' => 'airwallex', 'wallet' => 'apple_pay']))
            ->assertOk()
            ->assertJsonPath('session.intent_id', 'int_awx_ap_1');

        $placed = $this->postJson('/api/checkout/place-order', $this->checkoutPayload($variant, [
            'payment_method' => 'airwallex',
            'payment_context' => ['intent_id' => 'int_awx_ap_1', 'session_id' => 'AIRWALLEX-AP', 'wallet' => 'apple_pay'],
        ]))->assertCreated();
        $this->assertSame('apple_pay', Order::query()->findOrFail($placed->json('order.id'))->meta['payment_wallet']);

        Setting::set('payment_method_airwallex_apple_pay_enabled', false, 'boolean', 'payment');
        $this->assertNull($wallet('airwallex_apple_pay'));
        $this->postJson('/api/checkout/airwallex-session', array_replace($this->stripeAltSessionPayload($variant), ['payment_method' => 'airwallex', 'wallet' => 'apple_pay']))->assertStatus(422);
        $this->postJson('/api/checkout/place-order', $this->checkoutPayload($variant, [
            'payment_method' => 'airwallex',
            'payment_context' => ['intent_id' => 'int_awx_ap_2', 'session_id' => 'AIRWALLEX-AP2', 'wallet' => 'apple_pay'],
        ]))->assertStatus(422);
    }

    /**
     * @return array<string, array{0: string, 1: string}>
     */
    public static function airwallexRedirectMethods(): array
    {
        return ['klarna' => ['klarna', 'Klarna'], 'paypal' => ['paypal', 'PayPal']];
    }

    #[DataProvider('airwallexRedirectMethods')]
    public function test_airwallex_redirect_methods_create_the_order_then_confirm_the_intent_and_return_the_page_to_redirect_to(string $method, string $label): void
    {
        $this->configureAirwallex();
        $sent = [];
        Http::fake([
            'https://api-demo.airwallex.com/api/v1/authentication/login' => Http::response(['token' => 'awx_token']),
            'https://api-demo.airwallex.com/api/v1/pa/payment_intents/create' => Http::response(['id' => "int_awx_{$method}", 'client_secret' => 'awx_secret'], 201),
            'https://api-demo.airwallex.com/api/v1/pa/payment_intents/*/confirm' => Http::response(['next_action' => ['type' => 'redirect', 'method' => 'GET', 'url' => "https://pay.example.test/{$method}"]]),
        ]);
        $variant = $this->createPurchasableVariant();
        $listed = fn () => collect($this->getJson('/api/checkout/payment-methods')->json('methods'))->first(fn (array $entry): bool => $entry['method'] === "airwallex_{$method}" && $entry['enabled']);
        $this->assertNotNull($listed());
        $this->assertSame('redirect_method', $listed()['collection']);

        $session = $this->postJson('/api/checkout/airwallex-session', array_replace($this->stripeAltSessionPayload($variant), ['payment_method' => 'airwallex', 'wallet' => $method]))
            ->assertOk()
            ->assertJsonPath('session.intent_id', "int_awx_{$method}");
        $sessionId = $session->json('session.session_id');

        $placed = $this->postJson('/api/checkout/place-order', $this->checkoutPayload($variant, [
            'payment_method' => 'airwallex',
            'payment_context' => ['intent_id' => "int_awx_{$method}", 'session_id' => $sessionId, 'wallet' => $method],
        ]))->assertCreated();
        $order = Order::query()->findOrFail($placed->json('order.id'));
        $this->assertSame($method, $order->meta['airwallex_method']);
        $this->assertSame($label, $order->meta['payment_label']);
        $this->assertSame('airwallex', $order->meta['payment_gateway']);

        $this->postJson('/api/checkout/airwallex-confirm', ['intent_id' => "int_awx_{$method}", 'session_id' => $sessionId])
            ->assertOk()
            ->assertJsonPath('redirect_url', "https://pay.example.test/{$method}");

        Http::assertSent(function ($request) use ($method, &$sent): bool {
            if (! str_ends_with($request->url(), '/confirm')) {
                return false;
            }
            $sent = $request->data();

            return str_contains($request->url(), "/payment_intents/int_awx_{$method}/confirm") && ($request['payment_method']['type'] ?? null) === $method;
        });
        // Klarna refuses an intent whose order lines do not add up to the amount, and the other methods need no lines.
        Http::assertSent(function ($request) use ($method): bool {
            if (! str_ends_with($request->url(), '/payment_intents/create')) {
                return false;
            }
            if ($method !== 'klarna') {
                return ! isset($request['order']['products']);
            }
            $lines = collect($request['order']['products'] ?? [])->sum(fn (array $line): float => $line['unit_price'] * $line['quantity']);

            return abs($lines + ($request['order']['shipping']['fee_amount'] ?? 0) - $request['amount']) < 0.005;
        });
        if ($method === 'klarna') {
            $this->assertTrue($sent['payment_method_options']['klarna']['auto_capture']);
            $this->assertSame('guest@petposture.com', $sent['payment_method']['klarna']['billing']['email']);
        } else {
            $this->assertNotSame('', $sent['payment_method'][$method]['shopper_name']);
        }
    }

    public function test_paypal_express_has_its_own_switch_apart_from_the_paypal_radio(): void
    {
        $variant = $this->createPurchasableVariant();
        $offered = fn (string $method) => collect($this->getJson('/api/checkout/payment-methods')->json('methods'))->first(fn (array $entry): bool => $entry['method'] === $method && $entry['enabled']);
        $placeFrom = fn (string $paypalOrderId, ?string $wallet) => $this->postJson('/api/checkout/place-order', $this->checkoutPayload($variant, [
            'payment_method' => 'paypal',
            'payment_context' => array_filter(['paypal_order_id' => $paypalOrderId, 'wallet' => $wallet]),
        ]));

        $this->assertNotNull($offered('paypal'));
        $this->assertNotNull($offered('paypal_express'));

        // Radio off: the Express button (with its connection details) and its orders still work, the radio's do not.
        Setting::set('payment_method_paypal_enabled', false, 'boolean', 'payment');
        $this->assertNull($offered('paypal'));
        $this->assertNotNull($offered('paypal_express'));
        $this->assertArrayHasKey('client_id', $offered('paypal_express'));
        $placeFrom('PP-EXPRESS-1', 'express')->assertCreated();
        $placeFrom('PP-RADIO-1', null)->assertStatus(422);

        // The other way round.
        Setting::set('payment_method_paypal_enabled', true, 'boolean', 'payment');
        Setting::set('payment_method_paypal_express_enabled', false, 'boolean', 'payment');
        $this->assertNotNull($offered('paypal'));
        $this->assertNull($offered('paypal_express'));
        $placeFrom('PP-RADIO-2', null)->assertCreated();
        $placeFrom('PP-EXPRESS-2', 'express')->assertStatus(422);
    }

    public function test_airwallex_confirm_refuses_unknown_card_and_paid_orders_and_a_switched_off_method(): void
    {
        $this->configureAirwallex();
        $variant = $this->createPurchasableVariant();

        $this->postJson('/api/checkout/airwallex-confirm', ['intent_id' => 'int_nope', 'session_id' => 'AIRWALLEX-NOPE'])->assertStatus(422);

        // A plain card order has no redirect method to confirm.
        $this->postJson('/api/checkout/place-order', $this->checkoutPayload($variant, [
            'payment_method' => 'airwallex',
            'payment_context' => ['intent_id' => 'int_awx_card', 'session_id' => 'AIRWALLEX-CARD'],
        ]))->assertCreated();
        $this->postJson('/api/checkout/airwallex-confirm', ['intent_id' => 'int_awx_card', 'session_id' => 'AIRWALLEX-CARD'])->assertStatus(422);

        // A switched-off method cannot start an order at all.
        Setting::set('payment_method_airwallex_klarna_enabled', false, 'boolean', 'payment');
        $this->postJson('/api/checkout/place-order', $this->checkoutPayload($variant, [
            'payment_method' => 'airwallex',
            'payment_context' => ['intent_id' => 'int_awx_k', 'session_id' => 'AIRWALLEX-K', 'wallet' => 'klarna'],
        ]))->assertStatus(422);
    }

    public function test_airwallex_webhook_reads_the_card_of_a_google_pay_payment(): void
    {
        $this->configureAirwallex();
        config()->set('services.airwallex.merchant_id', 'acct_test_1');
        $variant = $this->createPurchasableVariant();
        $placed = $this->postJson('/api/checkout/place-order', $this->checkoutPayload($variant, [
            'payment_method' => 'airwallex',
            'payment_context' => ['intent_id' => 'int_awx_gp_paid', 'session_id' => 'AIRWALLEX-GPPAID', 'wallet' => 'google_pay'],
        ]));
        $placed->assertCreated();

        $this->postJson('/api/webhooks/airwallex', [
            'id' => 'evt_awx_gp_paid',
            'name' => 'payment_intent.succeeded',
            'data' => ['object' => [
                'id' => 'int_awx_gp_paid',
                'latest_payment_attempt' => ['payment_method' => ['type' => 'googlepay', 'googlepay' => ['tokenized_card' => ['brand' => 'visa', 'type' => 'DEBIT', 'last4' => '0008']]]],
            ]],
        ])->assertOk()->assertJsonPath('result.payment_status', 'paid');

        $order = Order::query()->findOrFail($placed->json('order.id'));
        $this->assertSame('visa', $order->meta['card_brand']);
        $this->assertSame('0008', $order->meta['card_last4']);
        $this->assertSame('debit', $order->meta['card_funding']);
    }

    public function test_airwallex_webhook_stores_the_risk_verdict_and_avs_cvc_3ds_checks(): void
    {
        $this->configureAirwallex();
        $this->makeAdmin();
        $variant = $this->createPurchasableVariant();
        $placed = $this->postJson('/api/checkout/place-order', $this->checkoutPayload($variant, [
            'payment_method' => 'airwallex',
            'payment_context' => ['intent_id' => 'int_awx_risk', 'session_id' => 'AIRWALLEX-RISK'],
        ]));
        $placed->assertCreated();

        $this->postJson('/api/webhooks/airwallex', [
            'id' => 'evt_awx_risk',
            'name' => 'payment_intent.succeeded',
            'data' => ['object' => [
                'id' => 'int_awx_risk',
                'latest_payment_attempt' => ['authentication_data' => [
                    'authentication_type' => '3ds',
                    'ds_data' => ['version' => '2.2.0', 'liability_shift_indicator' => 'Y', 'pa_res_status' => 'Y', 'frictionless' => 'N', 'cavv' => 'secret-cavv'],
                    'fraud_data' => ['action' => 'VERIFY', 'score' => '12', 'risk_factors' => ['ip_mismatch', ['name' => 'velocity']]],
                    'avs_result' => 'not_attempted',
                    'cvc_result' => 'matched',
                ]],
            ]],
        ])->assertOk();

        $order = Order::query()->findOrFail($placed->json('order.id'));
        $this->assertSame('verify', $order->meta['fraud_risk_level']);
        $this->assertSame(12, $order->meta['fraud_risk_score']);
        $this->assertSame('ip_mismatch, velocity', $order->meta['fraud_seller_message']);
        $this->assertSame('matched', $order->meta['fraud_checks']['cvc']);
        $this->assertSame('not_attempted', $order->meta['fraud_checks']['avs']);
        $this->assertSame(
            ['type' => '3ds', 'version' => '2.2.0', 'status' => 'Y', 'liability_shift' => 'Y', 'frictionless' => false],
            $order->meta['fraud_checks']['three_ds'],
        );
        $this->assertStringNotContainsString('secret-cavv', json_encode($order->meta));

        $this->getJson("/api/admin/orders/{$order->id}")
            ->assertOk()
            ->assertJsonPath('data.fraud_risk_level', 'verify')
            ->assertJsonPath('data.fraud_checks.three_ds.version', '2.2.0');

        // A later event without authentication_data must not wipe what is stored.
        $this->postJson('/api/webhooks/airwallex', [
            'id' => 'evt_awx_risk_later',
            'name' => 'payment_intent.succeeded',
            'data' => ['object' => ['id' => 'int_awx_risk']],
        ])->assertOk();
        $this->assertSame('verify', $order->fresh()->meta['fraud_risk_level']);
    }

    public function test_airwallex_webhook_without_3ds_stores_no_three_ds_block(): void
    {
        $this->configureAirwallex();
        $variant = $this->createPurchasableVariant();
        $placed = $this->postJson('/api/checkout/place-order', $this->checkoutPayload($variant, [
            'payment_method' => 'airwallex',
            'payment_context' => ['intent_id' => 'int_awx_no3ds', 'session_id' => 'AIRWALLEX-NO3DS'],
        ]));
        $placed->assertCreated();

        $this->postJson('/api/webhooks/airwallex', [
            'id' => 'evt_awx_no3ds',
            'name' => 'payment_intent.succeeded',
            'data' => ['object' => [
                'id' => 'int_awx_no3ds',
                'latest_payment_attempt' => ['authentication_data' => [
                    'ds_data' => ['retry_count_for_auth_decline' => 0],
                    'fraud_data' => ['action' => 'ACCEPT', 'score' => '0', 'risk_factors' => []],
                    'avs_result' => 'not_attempted',
                    'cvc_result' => 'matched',
                ]],
            ]],
        ])->assertOk();

        $meta = Order::query()->findOrFail($placed->json('order.id'))->meta;
        $this->assertSame('accept', $meta['fraud_risk_level']);
        $this->assertSame(0, $meta['fraud_risk_score']);
        $this->assertNull($meta['fraud_seller_message']);
        $this->assertNull($meta['fraud_checks']['three_ds']);
    }

    public function test_refunding_an_airwallex_order_calls_the_refund_api_with_the_intent_and_amount(): void
    {
        $this->configureAirwallex();
        $this->makeAdmin();
        Http::fake([
            'https://api-demo.airwallex.com/api/v1/authentication/login' => Http::response(['token' => 'awx_token']),
            'https://api-demo.airwallex.com/api/v1/pa/refunds/create' => Http::response(['id' => 'rfd_awx_1', 'status' => 'RECEIVED', 'amount' => 50.0], 201),
        ]);
        $order = Order::factory()->create([
            'status' => 'processing',
            'total' => 5000,
            'meta' => [
                'payment_gateway' => 'airwallex',
                'payment_status' => 'paid',
                'airwallex_intent_id' => 'int_awx_refund_1',
            ],
        ]);

        $this->postJson("/api/admin/orders/{$order->id}/refund", ['reason' => 'customer_request'])->assertOk();

        Http::assertSent(fn ($request): bool => str_ends_with($request->url(), '/pa/refunds/create')
            && $request['payment_intent_id'] === 'int_awx_refund_1'
            && (float) $request['amount'] === 50.0);
        $order = $order->fresh();
        $this->assertSame('rfd_awx_1', $order->meta['refund_id']);
        $this->assertSame('refunded', $order->meta['payment_status']);
    }

    public function test_refund_with_an_explicit_amount_equal_to_the_order_total_counts_as_a_full_refund(): void
    {
        $this->configureAirwallex();
        $this->makeAdmin();
        Http::fake([
            'https://api-demo.airwallex.com/api/v1/authentication/login' => Http::response(['token' => 'awx_token']),
            'https://api-demo.airwallex.com/api/v1/pa/refunds/create' => Http::response(['id' => 'rfd_awx_full', 'status' => 'RECEIVED', 'amount' => 50.0], 201),
        ]);
        $order = Order::factory()->create([
            'status' => 'processing',
            'total' => 5000,
            'meta' => [
                'payment_gateway' => 'airwallex',
                'payment_status' => 'paid',
                'airwallex_intent_id' => 'int_awx_full_1',
            ],
        ]);

        $this->postJson("/api/admin/orders/{$order->id}/refund", ['reason' => 'other', 'amount' => 50.00])->assertOk();

        $order = $order->fresh();
        $this->assertSame('refunded', $order->meta['payment_status']);
        $this->assertSame('Full refund issued', $order->orderEvents()->latest('id')->first()->title);
    }

    public function test_cancelling_a_paid_airwallex_order_auto_refunds_it_and_marks_it_refunded(): void
    {
        $this->configureAirwallex();
        Http::fake([
            'https://api-demo.airwallex.com/api/v1/authentication/login' => Http::response(['token' => 'awx_token']),
            'https://api-demo.airwallex.com/api/v1/pa/refunds/create' => Http::response(['id' => 'rfd_awx_cancel', 'status' => 'RECEIVED', 'amount' => 50.0], 201),
        ]);
        $order = Order::factory()->create([
            'status' => 'processing',
            'total' => 5000,
            'meta' => [
                'payment_gateway' => 'airwallex',
                'payment_status' => 'paid',
                'airwallex_intent_id' => 'int_awx_cancel_1',
            ],
        ]);

        app(OrderOperationsService::class)->update($order, ['status' => 'cancelled']);

        Http::assertSent(fn ($request): bool => str_ends_with($request->url(), '/pa/refunds/create')
            && $request['payment_intent_id'] === 'int_awx_cancel_1'
            && (float) $request['amount'] === 50.0);
        $order = $order->fresh();
        $this->assertSame('cancelled', $order->status);
        $this->assertSame('refunded', $order->meta['payment_status']);
        $this->assertSame('refunded', $order->meta['refund_status']);
        $this->assertSame('rfd_awx_cancel', $order->meta['refund_id']);
    }

    public function test_refunding_a_cash_on_delivery_order_succeeds_locally_without_a_payment_intent(): void
    {
        // COD never captures a real electronic payment, so there is nothing to call
        // out to Stripe/PayPal for — no payment_intent_id, no external HTTP call.
        $this->makeAdmin();
        Http::fake(); // any external call here would fail this test.

        $order = Order::factory()->create([
            'status' => 'processing',
            'total' => 5000,
            'meta' => [
                'payment_gateway' => 'manual-offline',
                'payment_status' => 'paid',
            ],
        ]);

        $this->postJson("/api/admin/orders/{$order->id}/refund", ['reason' => 'customer_request'])
            ->assertOk()
            ->assertJsonPath('data.refund_status', 'refunded')
            ->assertJsonPath('data.payment_status', 'refunded');

        Http::assertNothingSent();
        $this->assertSame('refunded', $order->fresh()->meta['payment_status']);
        $this->assertStringStartsWith('manual_', $order->fresh()->meta['refund_id']);
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

    public function test_admin_order_contract_exposes_safe_card_funding_and_paypal_payer_email(): void
    {
        $this->makeAdmin();
        $variant = $this->createPurchasableVariant();
        $orderData = $this->createPaidCardOrder($variant);
        $order = Order::findOrFail($orderData['order_id']);

        $meta = (array) ($order->meta ?? []);
        $meta['card_funding'] = 'debit';
        $meta['paypal_payer_email'] = 'paypal-buyer@example.com';
        $order->update(['meta' => $meta]);

        $response = $this->getJson("/api/admin/orders/{$order->id}");

        $response->assertOk()
            ->assertJsonPath('data.card_funding', 'debit')
            ->assertJsonPath('data.paypal_payer_email', 'paypal-buyer@example.com');
    }

    public function test_customer_order_endpoint_does_not_leak_card_funding_or_paypal_payer_email(): void
    {
        $user = User::factory()->create();
        Sanctum::actingAs($user);
        $variant = $this->createPurchasableVariant();

        $placeOrderResponse = $this->postJson('/api/checkout/place-order', $this->checkoutPayload($variant));
        $placeOrderResponse->assertCreated();
        $orderId = (int) $placeOrderResponse->json('order.id');

        $order = Order::findOrFail($orderId);
        $order->update([
            'user_id' => $user->id,
            'meta' => array_merge((array) ($order->meta ?? []), [
                'card_funding' => 'credit',
                'paypal_payer_email' => 'private-payer@example.com',
            ]),
        ]);

        $detailResponse = $this->getJson("/api/orders/{$orderId}");
        $detailResponse->assertOk()
            ->assertJsonMissingPath('data.card_funding')
            ->assertJsonMissingPath('data.paypal_payer_email');

        $listResponse = $this->getJson('/api/orders');
        $listResponse->assertOk()
            ->assertJsonMissingPath('data.0.card_funding')
            ->assertJsonMissingPath('data.0.paypal_payer_email');
    }

    public function test_supported_checkout_methods_and_manual_card_orders_use_generic_card_label(): void
    {
        $methodsResponse = $this->getJson('/api/checkout/payment-methods');
        $methodsResponse->assertOk();

        $cardMethod = collect($methodsResponse->json('methods'))
            ->firstWhere('method', 'card');
        $this->assertNotNull($cardMethod);
        $this->assertSame('Credit or Debit Card', $cardMethod['label']);

        $this->makeAdmin();
        $variant = $this->createPurchasableVariant();

        $manualResponse = $this->postJson('/api/admin/orders', $this->manualOrderPayload($variant, [
            'payment_method' => 'card',
        ]));

        $manualResponse->assertCreated()
            ->assertJsonPath('data.payment_label', 'Card');

        $order = Order::findOrFail($manualResponse->json('data.id'));
        $this->assertSame('Card', $order->meta['payment_label'] ?? null);
    }

    public function test_admin_order_resolves_configured_shipping_name_when_differing_from_code(): void
    {
        $this->makeAdmin();
        $variant = $this->createPurchasableVariant();

        ShippingMethod::firstOrCreate(
            ['code' => 'priority_express'],
            [
                'name' => 'Priority Express Overnight',
                'price' => 19.99,
            ]
        );

        $response = $this->postJson('/api/admin/orders', $this->manualOrderPayload($variant, [
            'shipping_method' => 'priority_express',
        ]));

        $response->assertCreated()
            ->assertJsonPath('data.shipping_label', 'Priority Express Overnight');
    }

    // ─── Helpers ─────────────────────────────────────────────────────────────

    public function test_place_order_answers_422_not_500_when_the_payment_method_is_switched_off(): void
    {
        $variant = $this->createPurchasableVariant();
        Setting::set('payment_method_paypal_enabled', false, 'boolean', 'payment');
        Setting::set('cod_enabled', false, 'boolean', 'payment');

        $this->postJson('/api/checkout/place-order', $this->checkoutPayload($variant, ['payment_method' => 'paypal']))
            ->assertUnprocessable()
            ->assertJsonPath('message', 'PayPal is unavailable. Please select another payment method.');

        $this->postJson('/api/checkout/place-order', $this->checkoutPayload($variant, ['payment_method' => 'cod']))
            ->assertUnprocessable();

        $this->postJson('/api/checkout/place-order', $this->checkoutPayload($variant, ['payment_method' => 'not-a-method']))
            ->assertUnprocessable();
    }

    public function test_wallet_orders_follow_the_wallet_switch_not_the_credit_card_switch(): void
    {
        // Wallets only exist once Stripe is configured (placeholder mode has no Stripe.js).
        config()->set('services.stripe.key', 'pk_test_wallets');
        config()->set('services.stripe.secret', 'sk_test_wallets');
        Cache::forget('stripe_key');
        Cache::forget('stripe_secret');
        $variant = $this->createPurchasableVariant();
        Setting::set('payment_method_card_enabled', false, 'boolean', 'payment');

        $this->postJson('/api/checkout/place-order', $this->checkoutPayload($variant, ['payment_method' => 'card']))
            ->assertUnprocessable()
            ->assertJsonPath('message', 'Credit or Debit Card is unavailable. Please select another payment method.');

        $response = $this->postJson('/api/checkout/place-order', $this->checkoutPayload($variant, [
            'payment_method' => 'card',
            'payment_context' => ['wallet' => 'apple_pay'],
        ]))->assertCreated();
        $this->assertSame('apple_pay', Order::query()->findOrFail($response->json('order.id'))->meta['payment_wallet']);

        Setting::set('payment_method_apple_pay_enabled', false, 'boolean', 'payment');

        $this->postJson('/api/checkout/place-order', $this->checkoutPayload($variant, [
            'payment_method' => 'card',
            'payment_context' => ['wallet' => 'apple_pay'],
        ]))->assertUnprocessable()
            ->assertJsonPath('message', 'Apple Pay is unavailable. Please select another payment method.');

        // A malformed wallet value must not crash checkout; it is treated as a plain card order.
        $this->postJson('/api/checkout/place-order', $this->checkoutPayload($variant, [
            'payment_method' => 'card',
            'payment_context' => ['wallet' => ['apple_pay']],
        ]))->assertUnprocessable();
    }

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
        $meta['payment_gateway'] = 'stripe';
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

    public function test_express_style_paypal_order_can_be_created_without_upfront_address_then_captured(): void
    {
        $variant = $this->createPurchasableVariant();

        $prepare = $this->postJson('/api/checkout/paypal-order', [
            'payment_method' => 'paypal',
            'items' => [['variantId' => $variant->id, 'quantity' => 1]],
            'currency' => 'usd',
        ]);
        $prepare->assertOk();
        $paypalOrderId = $prepare->json('paypal_order.paypal_order_id');
        $this->assertNotEmpty($paypalOrderId);

        $place = $this->postJson('/api/checkout/place-order', [
            'items' => [['variantId' => $variant->id, 'quantity' => 1]],
            'shipping' => [
                'email' => 'express@petposture.com', 'first_name' => 'Express', 'last_name' => 'Buyer',
                'line_one' => '1 Wallet Way', 'city' => 'Austin', 'state' => 'TX', 'postcode' => '78701', 'country' => 'US',
            ],
            'billing_same_as_shipping' => true,
            'payment_method' => 'paypal',
            'payment_context' => ['paypal_order_id' => $paypalOrderId],
        ]);
        $place->assertCreated();
        $order = Order::query()->findOrFail($place->json('order.id'));
        $this->assertSame($paypalOrderId, $order->meta['paypal_order_id']);

        $capture = $this->postJson('/api/checkout/paypal-capture', ['paypal_order_id' => $paypalOrderId]);
        $capture->assertOk();
        $this->assertSame('paid', $order->fresh()->meta['payment_status']);
    }

    public function test_express_style_card_order_reuses_the_existing_payment_intent_and_place_order_endpoints(): void
    {
        $variant = $this->createPurchasableVariant();

        config()->set('services.stripe.secret', 'sk_test_express_flow');
        Cache::forget('stripe_secret');
        Http::fake([
            'https://api.stripe.com/v1/payment_intents' => Http::response([
                'id' => 'pi_express_1', 'client_secret' => 'pi_express_1_secret', 'amount' => 8999,
                'currency' => 'usd', 'status' => 'requires_payment_method',
            ]),
        ]);

        $intent = $this->postJson('/api/checkout/payment-intent', [
            'payment_method' => 'card',
            'items' => [['variantId' => $variant->id, 'quantity' => 1]],
            'shipping' => ['state' => 'TX', 'country' => 'US', 'city' => 'Austin', 'postcode' => '78701'],
            'currency' => 'usd', 'email' => 'express@petposture.com',
        ]);
        $intent->assertOk();
        $intentId = $intent->json('payment_intent.intent_id');
        $this->assertSame('pi_express_1', $intentId);

        $place = $this->postJson('/api/checkout/place-order', [
            'items' => [['variantId' => $variant->id, 'quantity' => 1]],
            'shipping' => [
                'email' => 'express@petposture.com', 'first_name' => 'Express', 'last_name' => 'Buyer',
                'line_one' => '1 Wallet Way', 'city' => 'Austin', 'state' => 'TX', 'postcode' => '78701', 'country' => 'US',
            ],
            'billing_same_as_shipping' => true,
            'payment_method' => 'card',
            'payment_context' => ['intent_id' => $intentId],
        ]);
        $place->assertCreated();
    }

    public function test_stripe_alt_session_returns_a_safe_redirect_session_and_creates_a_method_specific_intent(): void
    {
        config()->set('services.stripe.key', 'pk_test_alt_checkout');
        config()->set('services.stripe.secret', 'sk_test_alt_checkout');
        config()->set('services.stripe.alt_methods', ['affirm']);
        Cache::forget('stripe_key');
        Cache::forget('stripe_secret');
        Http::fake([
            'https://api.stripe.com/v1/payment_intents' => Http::response([
                'id' => 'pi_alt_affirm_1',
                'client_secret' => 'pi_alt_affirm_1_secret',
                'amount' => 8999,
                'currency' => 'usd',
                'status' => 'requires_action',
            ]),
        ]);
        $variant = $this->createPurchasableVariant();

        $response = $this->postJson('/api/checkout/stripe-alt-session', $this->stripeAltSessionPayload($variant));

        $response->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('session.intent_id', 'pi_alt_affirm_1')
            ->assertJsonPath('session.client_secret', 'pi_alt_affirm_1_secret')
            ->assertJsonPath('session.amount', 8999)
            ->assertJsonPath('session.currency', 'USD')
            ->assertJsonPath('session.mode', 'configured')
            ->assertJsonPath('session.publishable_key', 'pk_test_alt_checkout');

        $sessionId = (string) $response->json('session.session_id');
        $this->assertMatchesRegularExpression('/^STRIPE-[A-Z0-9]{20}$/', $sessionId);
        $this->assertSame(
            rtrim((string) config('app.frontend_url'), '/').'/checkout/success?gateway=stripe&session_id='.$sessionId,
            $response->json('session.return_url'),
        );
        $this->assertStringNotContainsString('client_secret', $response->json('session.return_url'));

        Http::assertSent(fn ($request): bool => $request->url() === 'https://api.stripe.com/v1/payment_intents'
            && $request['payment_method_types[0]'] === 'affirm'
            && $request['shipping[name]'] === 'Jane Doe'
            && $request['shipping[address][line1]'] === '123 Congress Ave'
            && $request['shipping[address][country]'] === 'US'
            // Affirm builds its PaymentMethod on the client at confirm time;
            // Stripe also rejects payment_method_data[...] without a type.
            && ! array_key_exists('payment_method_data[type]', $request->data())
            && ! array_key_exists('payment_method_data[billing_details][email]', $request->data()));
    }

    public function test_stripe_alt_session_supports_afterpay_clearpay_and_sends_shipping_but_no_payment_method_data(): void
    {
        config()->set('services.stripe.key', 'pk_test_alt_checkout');
        config()->set('services.stripe.secret', 'sk_test_alt_checkout');
        config()->set('services.stripe.alt_methods', ['afterpay_clearpay']);
        Cache::forget('stripe_key');
        Cache::forget('stripe_secret');
        Http::fake([
            'https://api.stripe.com/v1/payment_intents' => Http::response([
                'id' => 'pi_alt_afterpay_1',
                'client_secret' => 'pi_alt_afterpay_1_secret',
                'amount' => 8999,
                'currency' => 'usd',
                'status' => 'requires_action',
            ]),
        ]);
        $variant = $this->createPurchasableVariant();

        $this->postJson('/api/checkout/stripe-alt-session', array_replace($this->stripeAltSessionPayload($variant), ['payment_method' => 'afterpay_clearpay']))
            ->assertOk()
            ->assertJsonPath('session.intent_id', 'pi_alt_afterpay_1');

        // Afterpay needs the shipping address on the intent (set with the secret key); its
        // billing details are sent by the client at confirm time, like Affirm.
        Http::assertSent(fn ($request): bool => $request->url() === 'https://api.stripe.com/v1/payment_intents'
            && $request['payment_method_types[0]'] === 'afterpay_clearpay'
            && $request['shipping[name]'] === 'Jane Doe'
            && $request['shipping[address][line1]'] === '123 Congress Ave'
            && ! array_key_exists('payment_method_data[type]', $request->data()));
    }

    public function test_stripe_alt_session_supports_amazon_pay_with_its_own_payment_method_type(): void
    {
        config()->set('services.stripe.key', 'pk_test_alt_checkout');
        config()->set('services.stripe.secret', 'sk_test_alt_checkout');
        config()->set('services.stripe.alt_methods', ['amazon_pay']);
        Cache::forget('stripe_key');
        Cache::forget('stripe_secret');
        Http::fake([
            'https://api.stripe.com/v1/payment_intents' => Http::response([
                'id' => 'pi_alt_amazon_1',
                'client_secret' => 'pi_alt_amazon_1_secret',
                'amount' => 8999,
                'currency' => 'usd',
                'status' => 'requires_action',
            ]),
        ]);
        $variant = $this->createPurchasableVariant();

        $this->postJson('/api/checkout/stripe-alt-session', array_replace($this->stripeAltSessionPayload($variant), ['payment_method' => 'amazon_pay']))
            ->assertOk()
            ->assertJsonPath('session.intent_id', 'pi_alt_amazon_1');

        Http::assertSent(fn ($request): bool => $request->url() === 'https://api.stripe.com/v1/payment_intents'
            && $request['payment_method_types[0]'] === 'amazon_pay'
            && $request['metadata[payment_method]'] === 'amazon_pay'
            && ! array_key_exists('payment_method_data[type]', $request->data()));
    }

    public function test_stripe_alt_session_maps_ach_debit_to_us_bank_account_with_instant_verification(): void
    {
        config()->set('services.stripe.key', 'pk_test_alt_checkout');
        config()->set('services.stripe.secret', 'sk_test_alt_checkout');
        config()->set('services.stripe.alt_methods', ['ach_debit']);
        Cache::forget('stripe_key');
        Cache::forget('stripe_secret');
        Http::fake([
            'https://api.stripe.com/v1/payment_intents' => Http::response([
                'id' => 'pi_alt_ach_1',
                'client_secret' => 'pi_alt_ach_1_secret',
                'amount' => 8999,
                'currency' => 'usd',
                'status' => 'requires_payment_method',
            ]),
        ]);
        $variant = $this->createPurchasableVariant();

        $this->postJson('/api/checkout/stripe-alt-session', array_replace($this->stripeAltSessionPayload($variant), ['payment_method' => 'ach_debit']))
            ->assertOk()
            ->assertJsonPath('session.intent_id', 'pi_alt_ach_1');

        Http::assertSent(fn ($request): bool => $request->url() === 'https://api.stripe.com/v1/payment_intents'
            && $request['payment_method_types[0]'] === 'us_bank_account'
            && $request['payment_method_options[us_bank_account][verification_method]'] === 'instant'
            && $request['metadata[payment_method]'] === 'ach_debit'
            && ! array_key_exists('payment_method_data[type]', $request->data()));
    }

    public function test_stripe_alt_session_attaches_billing_details_only_for_klarna(): void
    {
        config()->set('services.stripe.key', 'pk_test_alt_checkout');
        config()->set('services.stripe.secret', 'sk_test_alt_checkout');
        config()->set('services.stripe.alt_methods', ['klarna']);
        Cache::forget('stripe_key');
        Cache::forget('stripe_secret');
        Http::fake([
            'https://api.stripe.com/v1/payment_intents' => Http::response([
                'id' => 'pi_alt_klarna_1',
                'client_secret' => 'pi_alt_klarna_1_secret',
                'amount' => 8999,
                'currency' => 'usd',
                'status' => 'requires_confirmation',
            ]),
        ]);
        $variant = $this->createPurchasableVariant();

        $this->postJson('/api/checkout/stripe-alt-session', array_merge(
            $this->stripeAltSessionPayload($variant),
            ['payment_method' => 'klarna'],
        ))->assertOk()->assertJsonPath('session.intent_id', 'pi_alt_klarna_1');

        Http::assertSent(fn ($request): bool => $request->url() === 'https://api.stripe.com/v1/payment_intents'
            && $request['payment_method_types[0]'] === 'klarna'
            && $request['payment_method_data[type]'] === 'klarna'
            && $request['payment_method_data[billing_details][email]'] === 'guest@petposture.com'
            && $request['payment_method_data[billing_details][address][country]'] === 'US');
    }

    public function test_stripe_alt_session_rejects_disabled_method_and_out_of_range_amounts_without_calling_stripe(): void
    {
        config()->set('services.stripe.key', 'pk_test_alt_checkout');
        config()->set('services.stripe.secret', 'sk_test_alt_checkout');
        Cache::forget('stripe_key');
        Cache::forget('stripe_secret');
        Http::fake();
        $variant = $this->createPurchasableVariant();
        $payload = $this->stripeAltSessionPayload($variant);

        config()->set('services.stripe.alt_methods', []);
        $this->postJson('/api/checkout/stripe-alt-session', $payload)
            ->assertUnprocessable()
            ->assertJsonPath('message', 'Affirm - Pay Over Time is unavailable. Please select another payment method.');
        Http::assertNothingSent();

        config()->set('services.stripe.alt_methods', ['affirm']);
        Price::query()->where('priceable_id', $variant->id)->update(['price' => 1000]);
        $this->postJson('/api/checkout/stripe-alt-session', $payload)
            ->assertUnprocessable()
            ->assertJsonPath('message', "Affirm - Pay Over Time isn't available for this order amount.");
        Http::assertNothingSent();

        Price::query()->where('priceable_id', $variant->id)->update(['price' => 3_100_000]);
        $this->postJson('/api/checkout/stripe-alt-session', $payload)
            ->assertUnprocessable()
            ->assertJsonPath('message', "Affirm - Pay Over Time isn't available for this order amount.");
        Http::assertNothingSent();
    }

    public function test_stripe_payment_session_lookup_finds_recent_orders_and_rejects_unknown_or_expired_sessions(): void
    {
        $variant = $this->createPurchasableVariant();
        $placeResponse = $this->postJson('/api/checkout/place-order', $this->checkoutPayload($variant));
        $order = Order::query()->findOrFail($placeResponse->json('order.id'));
        $meta = (array) $order->meta;
        $meta['stripe_session_id'] = 'STRIPE-SESSION-123';
        $order->update(['meta' => $meta]);

        $this->getJson('/api/orders/by-payment-session?gateway=stripe&session_id=STRIPE-SESSION-123')
            ->assertOk()
            ->assertJsonPath('data.reference', $order->reference);

        $this->getJson('/api/orders/by-payment-session?gateway=stripe&session_id=STRIPE-UNKNOWN')
            ->assertNotFound();

        $order->update(['created_at' => now()->subHours(25)]);
        $this->getJson('/api/orders/by-payment-session?gateway=stripe&session_id=STRIPE-SESSION-123')
            ->assertNotFound();
    }

    public function test_stripe_webhook_marks_an_affirm_order_as_paid(): void
    {
        config()->set('services.stripe.alt_methods', ['affirm']);
        config()->set('services.stripe.key', 'pk_test_alt_checkout');
        config()->set('services.stripe.secret', 'sk_test_alt_checkout');
        config()->set('services.stripe.webhook_secret', null);
        Cache::forget('stripe_key');
        Cache::forget('stripe_secret');

        $variant = $this->createPurchasableVariant();
        $placeResponse = $this->postJson('/api/checkout/place-order', $this->checkoutPayload($variant, [
            'payment_method' => 'affirm',
            'payment_context' => ['intent_id' => 'pi_affirm_paid_123', 'session_id' => 'STRIPE-AFFIRM-123'],
        ]));
        $placeResponse->assertCreated();

        $this->postJson('/api/webhooks/stripe', [
            'id' => 'evt_affirm_paid_123',
            'type' => 'payment_intent.succeeded',
            'data' => ['object' => ['id' => 'pi_affirm_paid_123', 'status' => 'succeeded']],
        ])->assertOk()->assertJsonPath('result.payment_status', 'paid');

        $order = Order::query()->findOrFail($placeResponse->json('order.id'));
        $this->assertSame('affirm', $order->meta['payment_method']);
        $this->assertSame('paid', $order->meta['payment_status']);
    }

    public function test_a_declined_afterpay_order_reports_payment_failed_to_the_success_page(): void
    {
        config()->set('services.stripe.alt_methods', ['afterpay_clearpay']);
        config()->set('services.stripe.key', 'pk_test_alt_checkout');
        config()->set('services.stripe.secret', 'sk_test_alt_checkout');
        config()->set('services.stripe.webhook_secret', null);
        Cache::forget('stripe_key');
        Cache::forget('stripe_secret');

        $variant = $this->createPurchasableVariant();
        $this->postJson('/api/checkout/place-order', $this->checkoutPayload($variant, [
            'payment_method' => 'afterpay_clearpay',
            'payment_context' => ['intent_id' => 'pi_afterpay_fail_123', 'session_id' => 'STRIPE-AFTERPAY-FAIL'],
        ]))->assertCreated();

        $lookup = '/api/orders/by-payment-session?gateway=stripe&session_id=STRIPE-AFTERPAY-FAIL';
        $this->getJson($lookup)->assertOk()
            ->assertJsonPath('data.payment_label', 'Afterpay / Clearpay')
            ->assertJsonPath('data.payment_failed', false);

        $this->postJson('/api/webhooks/stripe', [
            'id' => 'evt_afterpay_fail_123',
            'type' => 'payment_intent.payment_failed',
            'data' => ['object' => ['id' => 'pi_afterpay_fail_123', 'status' => 'requires_payment_method']],
        ])->assertOk();

        $this->getJson($lookup)->assertOk()
            ->assertJsonPath('data.status', 'awaiting-payment')
            ->assertJsonPath('data.payment_failed', true);

        // The history records the failed attempt even though the order stays Awaiting payment.
        $failures = Order::query()->latest('id')->firstOrFail()->orderEvents()->where('type', 'payment.failed')->get();
        $this->assertCount(1, $failures);
        $this->assertSame('Payment failed', $failures->first()->title);
    }

    public function test_affirm_order_can_retry_with_card_and_updates_its_payment_method(): void
    {
        config()->set('services.stripe.alt_methods', ['affirm']);
        config()->set('services.stripe.key', 'pk_test_alt_checkout');
        config()->set('services.stripe.secret', 'sk_test_alt_checkout');
        config()->set('services.stripe.webhook_secret', null);
        Cache::forget('stripe_key');
        Cache::forget('stripe_secret');

        $variant = $this->createPurchasableVariant();
        $placeResponse = $this->postJson('/api/checkout/place-order', $this->checkoutPayload($variant, [
            'payment_method' => 'affirm',
            'payment_context' => ['intent_id' => 'pi_affirm_retry_123', 'session_id' => 'STRIPE-AFFIRM-RETRY'],
        ]));
        $placeResponse->assertCreated();

        config()->set('services.stripe.secret', null);
        Cache::forget('stripe_secret');

        $response = $this->postJson('/api/orders/retry-payment', [
            'tracking_token' => $placeResponse->json('order.tracking_access_token'),
            'email' => 'guest@petposture.com',
        ]);

        $response->assertOk()->assertJsonPath('success', true);
        $order = Order::query()->findOrFail($placeResponse->json('order.id'));
        $this->assertSame('card', $order->meta['payment_method']);
        $this->assertSame('Card', $order->meta['payment_label']);
        $this->assertSame('stripe', $order->meta['payment_gateway']);

        $this->postJson('/api/webhooks/stripe', [
            'id' => 'evt_affirm_retry_paid_123',
            'type' => 'payment_intent.succeeded',
            'data' => ['object' => ['id' => $response->json('payment_intent.intent_id'), 'status' => 'succeeded']],
        ])->assertOk()->assertJsonPath('result.payment_status', 'paid');

        $order->refresh();
        $this->assertSame('card', $order->meta['payment_method']);
        $this->assertSame('paid', $order->meta['payment_status']);
    }

    public function test_an_unpaid_airwallex_order_retries_on_airwallex_with_a_fresh_intent_for_the_same_order(): void
    {
        $this->configureAirwallex();
        $variant = $this->createPurchasableVariant();
        $placed = $this->postJson('/api/checkout/place-order', $this->checkoutPayload($variant, [
            'payment_method' => 'airwallex',
            'payment_context' => ['intent_id' => 'int_awx_old', 'session_id' => 'AIRWALLEX-OLD'],
        ]));
        $placed->assertCreated();
        Http::fake([
            'https://api-demo.airwallex.com/api/v1/authentication/login' => Http::response(['token' => 'awx_token']),
            'https://api-demo.airwallex.com/api/v1/pa/payment_intents/int_awx_old' => Http::response(['id' => 'int_awx_old', 'status' => 'REQUIRES_PAYMENT_METHOD']),
            'https://api-demo.airwallex.com/api/v1/pa/payment_intents/create' => Http::response(['id' => 'int_awx_new', 'client_secret' => 'awx_secret_new'], 201),
        ]);

        $response = $this->postJson('/api/orders/retry-payment', [
            'tracking_token' => $placed->json('order.tracking_access_token'),
            'email' => 'guest@petposture.com',
        ])->assertOk()
            ->assertJsonPath('payment_intent.gateway', 'airwallex')
            ->assertJsonPath('payment_intent.intent_id', 'int_awx_new')
            ->assertJsonPath('payment_intent.client_secret', 'awx_secret_new');

        $order = Order::query()->findOrFail($placed->json('order.id'));
        $this->assertSame('int_awx_new', $order->meta['airwallex_intent_id']);
        $this->assertSame($response->json('payment_intent.session_id'), $order->meta['airwallex_session_id']);
        $this->assertSame('airwallex', $order->meta['payment_gateway'], 'A retry must not turn the order into a Stripe card order.');
        Http::assertSent(fn ($request): bool => str_ends_with($request->url(), '/pa/payment_intents/create')
            && $request['metadata']['session_id'] === $response->json('payment_intent.session_id'));
    }

    public function test_an_airwallex_order_whose_payment_already_succeeded_cannot_be_retried(): void
    {
        $this->configureAirwallex();
        $variant = $this->createPurchasableVariant();
        $placed = $this->postJson('/api/checkout/place-order', $this->checkoutPayload($variant, [
            'payment_method' => 'airwallex',
            'payment_context' => ['intent_id' => 'int_awx_done', 'session_id' => 'AIRWALLEX-DONE'],
        ]));
        $placed->assertCreated();
        Http::fake([
            'https://api-demo.airwallex.com/api/v1/authentication/login' => Http::response(['token' => 'awx_token']),
            'https://api-demo.airwallex.com/api/v1/pa/payment_intents/int_awx_done' => Http::response(['id' => 'int_awx_done', 'status' => 'SUCCEEDED']),
        ]);

        $this->postJson('/api/orders/retry-payment', [
            'tracking_token' => $placed->json('order.tracking_access_token'),
            'email' => 'guest@petposture.com',
        ])->assertStatus(409);

        Http::assertNotSent(fn ($request): bool => str_ends_with($request->url(), '/pa/payment_intents/create'));
    }

    public function test_ach_order_cannot_open_a_second_payment_while_stripe_is_still_processing_the_first(): void
    {
        config()->set('services.stripe.alt_methods', ['ach_debit']);
        config()->set('services.stripe.key', 'pk_test_alt_checkout');
        config()->set('services.stripe.secret', 'sk_test_alt_checkout');
        config()->set('services.stripe.webhook_secret', null);
        Cache::forget('stripe_key');
        Cache::forget('stripe_secret');

        $variant = $this->createPurchasableVariant();
        $placeResponse = $this->postJson('/api/checkout/place-order', $this->checkoutPayload($variant, [
            'payment_method' => 'ach_debit',
            'payment_context' => ['intent_id' => 'pi_ach_processing_1', 'session_id' => 'STRIPE-ACH-PROCESSING'],
        ]));
        $placeResponse->assertCreated();

        Http::fake([
            'https://api.stripe.com/v1/payment_intents/pi_ach_processing_1' => Http::response([
                'id' => 'pi_ach_processing_1',
                'status' => 'processing',
                'amount' => 8999,
                'currency' => 'usd',
            ]),
        ]);

        $this->postJson('/api/orders/retry-payment', [
            'tracking_token' => $placeResponse->json('order.tracking_access_token'),
            'email' => 'guest@petposture.com',
        ])->assertStatus(409);

        $order = Order::query()->findOrFail($placeResponse->json('order.id'));
        $this->assertSame('pi_ach_processing_1', $order->meta['payment_intent_id'], 'The in-flight payment intent must not be replaced.');
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

    private function stripeAltSessionPayload(ProductVariant $variant): array
    {
        return [
            'payment_method' => 'affirm',
            'items' => [['variantId' => $variant->id, 'quantity' => 1]],
            'email' => 'guest@petposture.com',
            'shipping_method' => 'standard',
            'shipping' => [
                'first_name' => 'Jane',
                'last_name' => 'Doe',
                'line_one' => '123 Congress Ave',
                'city' => 'Austin',
                'state' => 'TX',
                'postcode' => '78701',
                'country' => 'US',
            ],
            'billing_same_as_shipping' => true,
        ];
    }
}
