<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Lunar\Models\Country;
use Lunar\Models\Currency;
use Lunar\Models\Order;
use Lunar\Models\OrderAddress;
use Lunar\Models\OrderLine;
use Tests\TestCase;

class OrderEmailPresentationTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        config(['app.name' => 'PetPosture']);
        config(['app.frontend_url' => 'https://petposture.com']);
    }

    public function test_all_five_views_render_successfully(): void
    {
        $order = $this->makeOrder();

        foreach (['confirmation', 'new-admin', 'cancelled-admin', 'cancelled', 'delivered'] as $key) {
            $html = $this->renderView($key, $order);
            $this->assertStringContainsString($order->reference, $html, "Failed asserting that view '{$key}' renders order reference.");
        }
    }

    public function test_order_confirmation_locks_existing_behavior(): void
    {
        $order = $this->makeOrder();
        $html = $this->renderView('confirmation', $order);

        $this->assertStringContainsString('+1-555-0199', $html, 'Order confirmation must contain shipping phone.');
        $this->assertStringContainsString('+1-555-0188', $html, 'Order confirmation must contain billing phone.');
        $this->assertStringContainsString('Subtotal &middot; 3 items', $html, 'Order confirmation must count 3 product items excluding shipping.');
        $this->assertStringContainsString('Shipping - Standard Shipping', $html, 'Order confirmation must contain shipping method.');
        $this->assertStringContainsString('Estimated Taxes', $html, 'Order confirmation must contain Estimated Taxes.');
        $this->assertStringContainsString('USD', $html, 'Order confirmation must contain currency code.');
        $this->assertStringContainsString('$118.25', $html, 'Order confirmation must contain formatted total.');
    }

    public function test_payment_presentation_card_with_brand_and_last4(): void
    {
        $order = $this->makeOrder([
            'payment_method' => 'card',
            'card_brand' => 'visa',
            'card_last4' => '4242',
            'card_funding' => 'credit',
        ]);

        foreach (['confirmation', 'new-admin', 'cancelled-admin'] as $key) {
            $html = $this->renderView($key, $order);
            $this->assertStringContainsString('4242', $html, "View '{$key}' should render card last4.");
            $this->assertStringContainsString('visa', strtolower($html), "View '{$key}' should reference visa.");
        }
    }

    public function test_payment_presentation_paypal_with_payer_email_and_no_capture_id(): void
    {
        $order = $this->makeOrder([
            'payment_method' => 'paypal',
            'payment_gateway' => 'paypal',
            'paypal_payer_email' => 'payer@example.com',
            'paypal_capture_id' => 'CAPTURE-SECRET-ID-999',
            'capture_id' => 'CAPTURE-SECRET-ID-888',
        ]);

        foreach (['confirmation', 'new-admin', 'cancelled-admin'] as $key) {
            $html = $this->renderView($key, $order);
            $this->assertStringContainsString('PayPal', $html, "View '{$key}' should render PayPal label.");
            $this->assertStringContainsString('payer@example.com', $html, "View '{$key}' should render paypal_payer_email.");
            $this->assertStringNotContainsString('CAPTURE-SECRET-ID-999', $html, "View '{$key}' must never leak capture ID.");
            $this->assertStringNotContainsString('CAPTURE-SECRET-ID-888', $html, "View '{$key}' must never leak capture ID.");
        }
    }

    public function test_payment_presentation_webhook_race_fallback_to_generic_card(): void
    {
        // Stripe payment succeeded but webhook with card_brand/last4 has not arrived yet
        $order = $this->makeOrder([
            'payment_method' => 'card',
            'card_brand' => null,
            'card_last4' => null,
            'card_funding' => null,
        ]);

        foreach (['confirmation', 'new-admin', 'cancelled-admin'] as $key) {
            $html = $this->renderView($key, $order);
            $this->assertStringContainsString('Card', $html, "View '{$key}' should fall back to generic Card.");
            $this->assertStringNotContainsString('&bull;&bull;&bull;&bull;', $html, "View '{$key}' must not fabricate bullets.");
        }
    }

    public function test_payment_presentation_funding_specific_copy(): void
    {
        $debitOrder = $this->makeOrder([
            'payment_method' => 'card',
            'card_brand' => null,
            'card_last4' => null,
            'card_funding' => 'debit',
        ]);
        $html = $this->renderView('confirmation', $debitOrder);
        $this->assertStringContainsString('Debit Card', $html);

        $prepaidOrder = $this->makeOrder([
            'payment_method' => 'card',
            'card_brand' => null,
            'card_last4' => null,
            'card_funding' => 'prepaid',
        ]);
        $htmlPrepaid = $this->renderView('confirmation', $prepaidOrder);
        $this->assertStringContainsString('Prepaid Card', $htmlPrepaid);
    }

    public function test_address_presentation_includes_phones_in_admin_and_delivered_emails(): void
    {
        $order = $this->makeOrder();

        $newAdminHtml = $this->renderView('new-admin', $order);
        $this->assertStringContainsString('+1-555-0199', $newAdminHtml, 'New order admin must display shipping phone.');
        $this->assertStringContainsString('+1-555-0188', $newAdminHtml, 'New order admin must display billing phone.');

        $cancelledAdminHtml = $this->renderView('cancelled-admin', $order);
        $this->assertStringContainsString('+1-555-0199', $cancelledAdminHtml, 'Cancelled order admin must display shipping phone.');
        $this->assertStringContainsString('+1-555-0188', $cancelledAdminHtml, 'Cancelled order admin must display billing phone.');

        $deliveredHtml = $this->renderView('delivered', $order);
        $this->assertStringContainsString('+1-555-0199', $deliveredHtml, 'Delivered order email must display shipping phone.');
    }

    public function test_address_presentation_has_no_cross_address_phone_fallback(): void
    {
        $order = $this->makeOrder();
        // Null out billing address phone explicitly
        $billing = $order->billingAddress;
        $billing->update(['contact_phone' => null]);
        $order->load('addresses.country');

        $html = $this->renderView('new-admin', $order);
        $this->assertStringContainsString('+1-555-0199', $html, 'Shipping address retains its phone.');
        $this->assertStringNotContainsString('+1-555-0188', $html, 'Billing address with null phone does not render old phone.');
    }

    public function test_summary_rows_normalization_item_count_and_shipping(): void
    {
        $order = $this->makeOrder();

        foreach (['confirmation', 'new-admin', 'cancelled-admin', 'cancelled'] as $key) {
            $html = $this->renderView($key, $order);
            $this->assertStringContainsString('Subtotal &middot; 3 items', $html, "View '{$key}' must display 'Subtotal · 3 items'.");
            $this->assertStringContainsString('Estimated Taxes', $html, "View '{$key}' must use exact label 'Estimated Taxes'.");
        }
    }

    public function test_summary_rows_total_formats_currency_code_first(): void
    {
        $order = $this->makeOrder();

        foreach (['confirmation', 'new-admin', 'cancelled-admin', 'cancelled'] as $key) {
            $html = $this->renderView($key, $order);
            // The grand Total row is the last place the total amount renders on the
            // page (payment/card detail lines may separately show "$amount CURRENCY"
            // in the opposite order, which the plan does not constrain).
            $amountPos = strrpos($html, '$118.25');
            $this->assertNotFalse($amountPos, "View '{$key}' must contain total amount $118.25.");
            $usdPos = strrpos(substr($html, 0, $amountPos), 'USD');
            $this->assertNotFalse($usdPos, "View '{$key}' must contain currency code USD before the total amount.");
        }
    }

    public function test_summary_rows_dynamic_currency_cad(): void
    {
        $order = $this->makeOrder([], 'CAD');

        foreach (['confirmation', 'new-admin', 'cancelled-admin', 'cancelled'] as $key) {
            $html = $this->renderView($key, $order);
            $this->assertStringContainsString('CAD', $html, "View '{$key}' must display CAD currency code.");
            $amountPos = strrpos($html, '$118.25');
            $this->assertNotFalse($amountPos, "View '{$key}' must contain total amount $118.25.");
            $cadPos = strrpos(substr($html, 0, $amountPos), 'CAD');
            $this->assertNotFalse($cadPos, "View '{$key}' must contain CAD before the total amount.");
        }
    }

    public function test_all_views_render_with_minimal_or_empty_meta(): void
    {
        $order = $this->makeOrder([], 'USD');
        $order->update(['meta' => []]);

        foreach (['confirmation', 'new-admin', 'cancelled-admin', 'cancelled', 'delivered'] as $key) {
            $html = $this->renderView($key, $order);
            $this->assertNotEmpty($html, "View '{$key}' must render without throwing on empty meta.");
        }
    }

    protected function renderView(string $key, Order $order): string
    {
        $order->load(['lines', 'addresses.country']);

        return match ($key) {
            'confirmation' => view('mail.order-confirmation', ['order' => $order, 'trackingToken' => 'test-token-123'])->render(),
            'new-admin' => view('mail.new-order-admin', ['order' => $order])->render(),
            'cancelled-admin' => view('mail.cancelled-order-admin', ['order' => $order])->render(),
            'cancelled' => view('mail.order-cancelled', ['order' => $order])->render(),
            'delivered' => view('mail.order-delivered', ['order' => $order])->render(),
            default => throw new \InvalidArgumentException("Unknown view key: {$key}"),
        };
    }

    protected function makeOrder(array $meta = [], string $currencyCode = 'USD'): Order
    {
        $currency = Currency::firstOrCreate(
            ['code' => $currencyCode],
            [
                'name' => $currencyCode,
                'decimal_places' => 2,
                'enabled' => true,
                'exchange_rate' => 1,
                'default' => true,
            ]
        );

        $country = Country::firstOrCreate(
            ['iso2' => 'US'],
            [
                'iso3' => 'USA',
                'name' => 'United States',
                'phonecode' => 1,
                'currency' => 'USD',
                'emoji' => '🇺🇸',
                'emoji_u' => 'U+1F1FA U+1F1F8',
            ]
        );

        $defaultMeta = [
            'shipping_method' => 'standard',
            'payment_method' => 'card',
            'payment_status' => 'paid',
            'payment_label' => 'Credit Card',
            'card_brand' => 'visa',
            'card_last4' => '4242',
        ];

        $order = Order::factory()->create([
            'currency_code' => $currency->code,
            'sub_total' => 11000,
            'discount_total' => 0,
            'shipping_total' => 500,
            'tax_total' => 325,
            'total' => 11825,
            'meta' => array_merge($defaultMeta, $meta),
        ]);

        OrderLine::factory()->create([
            'order_id' => $order->id,
            'type' => 'physical',
            'description' => 'Pet Posture Harness',
            'quantity' => 1,
            'total' => 5000,
        ]);

        OrderLine::factory()->create([
            'order_id' => $order->id,
            'type' => 'physical',
            'description' => 'Comfort Replacement Strap',
            'quantity' => 2,
            'total' => 6000,
        ]);

        OrderLine::factory()->create([
            'order_id' => $order->id,
            'type' => 'shipping',
            'description' => 'Standard Shipping',
            'quantity' => 1,
            'total' => 500,
        ]);

        OrderAddress::factory()->create([
            'order_id' => $order->id,
            'type' => 'shipping',
            'first_name' => 'John',
            'last_name' => 'Doe',
            'line_one' => '123 Main St',
            'line_two' => 'Apt 4B',
            'city' => 'Austin',
            'state' => 'TX',
            'postcode' => '78701',
            'country_id' => $country->id,
            'contact_phone' => '+1-555-0199',
            'contact_email' => 'john@example.com',
        ]);

        OrderAddress::factory()->create([
            'order_id' => $order->id,
            'type' => 'billing',
            'first_name' => 'Jane',
            'last_name' => 'Doe',
            'line_one' => '456 Billing St',
            'line_two' => null,
            'city' => 'Dallas',
            'state' => 'TX',
            'postcode' => '75201',
            'country_id' => $country->id,
            'contact_phone' => '+1-555-0188',
            'contact_email' => 'jane@example.com',
        ]);

        return $order->fresh(['lines', 'addresses.country']);
    }
}
