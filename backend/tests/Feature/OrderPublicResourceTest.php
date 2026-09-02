<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Lunar\FieldTypes\Text;
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
use Tests\TestCase;

/**
 * Public order access is gated by a random tracking token plus email. These
 * endpoints must only return purpose-built minimal DTOs and never serialize the
 * full staff-facing OrderResource.
 */
class OrderPublicResourceTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Queue::fake();
        config()->set('services.stripe.secret', null);
        config()->set('services.stripe.webhook_secret', null);
    }

    public function test_tracking_requires_a_random_access_token_and_returns_only_the_tracking_dto(): void
    {
        $variant = $this->createPurchasableVariant();
        $placeResponse = $this->postJson('/api/checkout/place-order', $this->checkoutPayload($variant));
        $placeResponse->assertCreated();

        $reference = (string) $placeResponse->json('order.reference');
        $trackingToken = (string) $placeResponse->json('order.tracking_access_token');
        $this->assertSame(64, strlen($trackingToken));
        $this->assertDatabaseHas('lunar_orders', [
            'reference' => $reference,
            'tracking_access_token_hash' => hash('sha256', $trackingToken),
        ]);
        $this->assertDatabaseMissing('lunar_orders', [
            'reference' => $reference,
            'tracking_access_token_hash' => $trackingToken,
        ]);

        $this->postJson('/api/orders/track', [
            'tracking_token' => $reference,
            'email' => 'guest@petposture.com',
        ])->assertNotFound()
            ->assertJsonPath('message', 'Unable to access this order.');

        $response = $this->postJson('/api/orders/track', [
            'tracking_token' => $trackingToken,
            'email' => 'guest@petposture.com',
        ]);

        $response->assertOk()
            ->assertJsonStructure([
                'data' => [
                    'reference',
                    'status',
                    'fulfillment_status',
                    'carrier',
                    'eta',
                    'shipping_address' => ['city', 'state', 'postcode', 'country'],
                    'total',
                    'lines' => [['id', 'description', 'quantity', 'unit_price', 'sub_total', 'image']],
                ],
            ])
            ->assertJsonMissingPath('data.id')
            ->assertJsonMissingPath('data.customer_email')
            ->assertJsonMissingPath('data.payment_status')
            ->assertJsonMissingPath('data.payment_method')
            ->assertJsonMissingPath('data.payment_intent_id')
            ->assertJsonMissingPath('data.billing_address')
            ->assertJsonMissingPath('data.shipping_address.line_one')
            ->assertJsonMissingPath('data.shipping_address.phone');
    }

    public function test_authenticated_owner_can_rotate_tracking_access_for_an_account_order(): void
    {
        $user = User::factory()->create(['email' => 'owner@petposture.com']);
        Sanctum::actingAs($user);
        $variant = $this->createPurchasableVariant();
        $placeResponse = $this->postJson('/api/checkout/place-order', $this->checkoutPayload($variant, [
            'shipping' => ['email' => $user->email],
        ]));
        $orderId = $placeResponse->json('order.id');
        $oldToken = $placeResponse->json('order.tracking_access_token');

        $response = $this->postJson("/api/orders/{$orderId}/tracking-access");

        $response->assertOk();
        $newToken = (string) $response->json('tracking_access_token');
        $this->assertSame(64, strlen($newToken));
        $this->assertNotSame($oldToken, $newToken);

        Sanctum::actingAs(User::factory()->create());
        $this->postJson("/api/orders/{$orderId}/tracking-access")->assertNotFound();
    }

    public function test_track_endpoint_never_leaks_internal_or_staff_only_fields(): void
    {
        $variant = $this->createPurchasableVariant();
        $placeResponse = $this->postJson('/api/checkout/place-order', $this->checkoutPayload($variant));
        $placeResponse->assertCreated();

        $orderId = $placeResponse->json('order.id');
        $order = Order::find($orderId);
        $meta = (array) ($order->meta ?? []);
        $meta['internal_note'] = 'Flagged for review — repeat chargeback risk.';
        $meta['payment_intent_id'] = 'pi_should_not_leak';
        $meta['refund_status'] = 'refunded';
        $meta['refund_id'] = 're_should_not_leak';
        $meta['refund_amount'] = 500;
        $order->update(['meta' => $meta]);

        $response = $this->postJson('/api/orders/track', [
            'tracking_token' => $placeResponse->json('order.tracking_access_token'),
            'email' => 'guest@petposture.com',
        ]);

        $response->assertOk();

        $response->assertJsonMissingPath('data.internal_note');
        $response->assertJsonMissingPath('data.payment_intent_id');
        $response->assertJsonMissingPath('data.payment_gateway');
        $response->assertJsonMissingPath('data.payment_collection');
        $response->assertJsonMissingPath('data.payment_last_event_type');
        $response->assertJsonMissingPath('data.refund_status');
        $response->assertJsonMissingPath('data.refund_id');
        $response->assertJsonMissingPath('data.refund_amount');
        $response->assertJsonMissingPath('data.refunded_at');
        $response->assertJsonMissingPath('data.returned_at');
        $response->assertJsonMissingPath('data.order_events');
        $response->assertJsonMissingPath('data.available_actions');
        $response->assertJsonMissingPath('data.tax_provider');

        $response->assertJsonPath('data.reference', $placeResponse->json('order.reference'))
            ->assertJsonStructure([
                'data' => ['status', 'fulfillment_status', 'carrier', 'eta', 'shipping_address', 'total', 'lines'],
            ])
            ->assertJsonMissingPath('data.customer_email')
            ->assertJsonMissingPath('data.payment_status')
            ->assertJsonMissingPath('data.payment_method')
            ->assertJsonMissingPath('data.billing_address');
    }

    public function test_retry_payment_endpoint_never_leaks_internal_or_staff_only_fields(): void
    {
        $variant = $this->createPurchasableVariant();
        $placeResponse = $this->postJson('/api/checkout/place-order', $this->checkoutPayload($variant, [
            'payment_method' => 'card',
            'payment_context' => [
                'intent_id' => 'pi_test_retry_123',
                'client_secret' => 'pi_test_retry_123_secret',
                'status' => 'requires_payment_method',
            ],
        ]));
        $placeResponse->assertCreated();

        $order = Order::find($placeResponse->json('order.id'));
        $meta = (array) ($order->meta ?? []);
        $meta['internal_note'] = 'Do not disclose to customer.';
        $order->update(['meta' => $meta]);

        $response = $this->postJson('/api/orders/retry-payment', [
            'tracking_token' => $placeResponse->json('order.tracking_access_token'),
            'email' => 'guest@petposture.com',
        ]);

        $response->assertOk();
        $response->assertJsonMissingPath('order.internal_note');
        $response->assertJsonMissingPath('order.order_events');
        $response->assertJsonMissingPath('order.available_actions');
    }

    public function test_payment_session_lookup_rotates_and_returns_a_new_tracking_token(): void
    {
        $variant = $this->createPurchasableVariant();
        $placeResponse = $this->postJson('/api/checkout/place-order', $this->checkoutPayload($variant));
        $oldToken = (string) $placeResponse->json('order.tracking_access_token');
        $order = Order::query()->findOrFail($placeResponse->json('order.id'));
        $meta = (array) $order->meta;
        $meta['airwallex_session_id'] = 'awx_rotation_123';
        $order->update(['meta' => $meta]);

        $response = $this->getJson('/api/orders/by-payment-session?gateway=airwallex&session_id=awx_rotation_123');

        $response->assertOk();
        $newToken = (string) $response->json('data.tracking_access_token');
        $this->assertSame(64, strlen($newToken));
        $this->assertNotSame($oldToken, $newToken);
        $this->assertSame(hash('sha256', $newToken), $order->fresh()->tracking_access_token_hash);

        $this->postJson('/api/orders/track', [
            'tracking_token' => $oldToken,
            'email' => 'guest@petposture.com',
        ])->assertNotFound();
        $this->postJson('/api/orders/track', [
            'tracking_token' => $newToken,
            'email' => 'guest@petposture.com',
        ])->assertOk();
    }

    public function test_expired_payment_session_cannot_rotate_tracking_access(): void
    {
        $variant = $this->createPurchasableVariant();
        $placeResponse = $this->postJson('/api/checkout/place-order', $this->checkoutPayload($variant));
        $order = Order::query()->findOrFail($placeResponse->json('order.id'));
        $meta = (array) $order->meta;
        $meta['airwallex_session_id'] = 'awx_expired_123';
        $order->update([
            'meta' => $meta,
            'created_at' => now()->subHours(25),
        ]);

        $this->getJson('/api/orders/by-payment-session?gateway=airwallex&session_id=awx_expired_123')
            ->assertNotFound()
            ->assertJsonPath('message', 'Unable to access this order.');
    }

    public function test_retry_payment_rejects_expired_or_paid_orders_without_leaking_status(): void
    {
        $variant = $this->createPurchasableVariant();
        $placeResponse = $this->postJson('/api/checkout/place-order', $this->checkoutPayload($variant, [
            'payment_method' => 'card',
            'payment_context' => [
                'intent_id' => 'pi_retry_eligibility_123',
                'client_secret' => 'pi_retry_eligibility_123_secret',
                'status' => 'requires_payment_method',
            ],
        ]));
        $token = (string) $placeResponse->json('order.tracking_access_token');
        $order = Order::query()->findOrFail($placeResponse->json('order.id'));

        $order->forceFill(['tracking_access_token_expires_at' => now()->subMinute()])->save();
        $this->postJson('/api/orders/retry-payment', [
            'tracking_token' => $token,
            'email' => 'guest@petposture.com',
        ])->assertNotFound()
            ->assertJsonPath('message', 'Unable to access this order.');

        $meta = (array) $order->meta;
        $meta['payment_status'] = 'paid';
        $order->forceFill([
            'tracking_access_token_expires_at' => now()->addDay(),
            'meta' => $meta,
        ])->save();

        $this->postJson('/api/orders/retry-payment', [
            'tracking_token' => $token,
            'email' => 'guest@petposture.com',
        ])->assertUnprocessable()
            ->assertJsonPath('message', 'Payment retry is unavailable.');
    }

    public function test_public_order_rate_limit_uses_hashed_credentials_across_ips(): void
    {
        $payload = [
            'tracking_token' => Str::random(64),
            'email' => 'rate-limit@petposture.com',
        ];

        $subnet = hexdec(substr(hash('sha256', $payload['tracking_token']), 0, 2));

        for ($attempt = 1; $attempt <= 5; $attempt++) {
            $this->withServerVariables(['REMOTE_ADDR' => "10.{$subnet}.0.{$attempt}"])
                ->postJson('/api/orders/track', $payload)
                ->assertNotFound();
        }

        $this->withServerVariables(['REMOTE_ADDR' => "10.{$subnet}.0.99"])
            ->postJson('/api/orders/track', $payload)
            ->assertTooManyRequests();
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
