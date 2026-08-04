<?php

namespace Tests\Feature;

use App\Models\OrderShipment;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Str;
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

class AfterShipWebhookTest extends TestCase
{
    use RefreshDatabase;

    private const WEBHOOK_SECRET = 'test-aftership-secret';

    protected function setUp(): void
    {
        parent::setUp();
        Queue::fake();
        Mail::fake();
        config(['services.aftership.webhook_secret' => self::WEBHOOK_SECRET]);
    }

    public function test_rejects_invalid_signature(): void
    {
        $payload = ['msg' => ['tracking_number' => 'TRACK1', 'tag' => 'Delivered']];

        $response = $this->call('POST', '/api/webhooks/aftership', [], [], [], [
            'HTTP_Aftership-Hmac-Sha256' => 'not-a-real-signature',
        ], json_encode($payload));

        $response->assertStatus(401);
    }

    public function test_rejects_missing_tracking_data(): void
    {
        $this->postSignedWebhook(['msg' => ['tracking_number' => '', 'tag' => 'Delivered']])
            ->assertStatus(422);
    }

    public function test_ignores_non_delivered_event(): void
    {
        ['shipment' => $shipment] = $this->placeShippedOrderWithShipment();

        $this->postSignedWebhook(['msg' => ['tracking_number' => $shipment->tracking_number, 'tag' => 'InTransit']])
            ->assertOk()
            ->assertJsonPath('message', 'Ignored (not a delivered event)');

        $this->assertSame(OrderShipment::STATUS_IN_TRANSIT, $shipment->fresh()->status);
    }

    public function test_returns_ok_for_unknown_tracking_number(): void
    {
        $this->postSignedWebhook(['msg' => ['tracking_number' => 'DOES-NOT-EXIST', 'tag' => 'Delivered']])
            ->assertOk()
            ->assertJsonPath('message', 'No matching shipment');
    }

    public function test_marks_single_shipment_order_delivered(): void
    {
        ['order_id' => $orderId, 'shipment' => $shipment] = $this->placeShippedOrderWithShipment();

        $this->postSignedWebhook(['msg' => ['tracking_number' => $shipment->tracking_number, 'tag' => 'Delivered']])
            ->assertOk()
            ->assertJsonPath('message', 'Order marked as delivered');

        $this->assertSame(OrderShipment::STATUS_DELIVERED, $shipment->fresh()->status);
        $this->assertSame('delivered', Order::find($orderId)->status);
    }

    public function test_repeated_delivered_event_is_idempotent(): void
    {
        ['shipment' => $shipment] = $this->placeShippedOrderWithShipment();

        $this->postSignedWebhook(['msg' => ['tracking_number' => $shipment->tracking_number, 'tag' => 'Delivered']])
            ->assertOk();

        $this->postSignedWebhook(['msg' => ['tracking_number' => $shipment->tracking_number, 'tag' => 'Delivered']])
            ->assertOk()
            ->assertJsonPath('message', 'Already delivered');
    }

    public function test_order_stays_shipped_until_every_shipment_is_delivered(): void
    {
        ['order_id' => $orderId, 'shipment' => $firstShipment] = $this->placeShippedOrderWithShipment();

        $secondShipment = OrderShipment::create([
            'order_id' => $orderId,
            'tracking_number' => 'TRACK-SECOND-'.Str::upper(Str::random(6)),
            'carrier' => 'ups',
            'status' => OrderShipment::STATUS_IN_TRANSIT,
        ]);

        $this->postSignedWebhook(['msg' => ['tracking_number' => $firstShipment->tracking_number, 'tag' => 'Delivered']])
            ->assertOk()
            ->assertJsonPath('message', 'Shipment delivered, awaiting remaining package(s)');

        $this->assertSame(OrderShipment::STATUS_DELIVERED, $firstShipment->fresh()->status);
        $this->assertSame('shipped', Order::find($orderId)->status);

        $this->postSignedWebhook(['msg' => ['tracking_number' => $secondShipment->tracking_number, 'tag' => 'Delivered']])
            ->assertOk()
            ->assertJsonPath('message', 'Order marked as delivered');

        $this->assertSame('delivered', Order::find($orderId)->status);
    }

    // ─── Helpers ─────────────────────────────────────────────────────────────

    private function postSignedWebhook(array $payload)
    {
        $body = json_encode($payload);
        $signature = base64_encode(hash_hmac('sha256', $body, self::WEBHOOK_SECRET, true));

        return $this->call('POST', '/api/webhooks/aftership', [], [], [], [
            'HTTP_Aftership-Hmac-Sha256' => $signature,
            'CONTENT_TYPE' => 'application/json',
        ], $body);
    }

    /**
     * @return array{order_id: int, shipment: OrderShipment}
     */
    private function placeShippedOrderWithShipment(): array
    {
        $variant = $this->createPurchasableVariant();
        $placeResponse = $this->postJson('/api/checkout/place-order', $this->checkoutPayload($variant));
        $placeResponse->assertCreated();

        $orderId = $placeResponse->json('order.id');

        $order = Order::find($orderId);
        $meta = (array) ($order->meta ?? []);
        $meta['payment_intent_id'] = 'pi_test_'.Str::lower(Str::random(12));
        $meta['payment_status'] = 'paid';
        $order->update(['status' => 'shipped', 'meta' => $meta]);

        $shipment = OrderShipment::create([
            'order_id' => $orderId,
            'tracking_number' => 'TRACK-'.Str::upper(Str::random(8)),
            'carrier' => 'ups',
            'status' => OrderShipment::STATUS_IN_TRANSIT,
        ]);

        return ['order_id' => $orderId, 'shipment' => $shipment];
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
