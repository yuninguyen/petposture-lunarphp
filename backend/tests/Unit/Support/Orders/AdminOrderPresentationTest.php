<?php

namespace Tests\Unit\Support\Orders;

use App\Support\Orders\AdminOrderPresentation;
use PHPUnit\Framework\TestCase;

class AdminOrderPresentationTest extends TestCase
{
    public function test_payment_method_handles_generic_card_and_funding_variants(): void
    {
        $this->assertSame('Card', AdminOrderPresentation::paymentMethod([
            'payment_method' => 'card',
        ]));

        $this->assertSame('Credit Card - Visa •••• 4242', AdminOrderPresentation::paymentMethod([
            'payment_method' => 'card',
            'card_funding' => 'credit',
            'card_brand' => 'visa',
            'card_last4' => '4242',
        ]));

        $this->assertSame('Debit Card - Mastercard •••• 5555', AdminOrderPresentation::paymentMethod([
            'payment_method' => 'card',
            'card_funding' => 'debit',
            'card_brand' => 'mastercard',
            'card_last4' => '5555',
        ]));

        $this->assertSame('Prepaid Card - Amex •••• 0005', AdminOrderPresentation::paymentMethod([
            'payment_method' => 'card',
            'card_funding' => 'prepaid',
            'card_brand' => 'amex',
            'card_last4' => '0005',
        ]));

        $this->assertSame('Card - Visa •••• 1111', AdminOrderPresentation::paymentMethod([
            'payment_method' => 'card',
            'card_funding' => 'unknown',
            'card_brand' => 'visa',
            'card_last4' => '1111',
        ]));

        $this->assertSame('Debit Card', AdminOrderPresentation::paymentMethod([
            'payment_method' => 'card',
            'card_funding' => 'debit',
        ]));

        $this->assertSame('Card •••• 9999', AdminOrderPresentation::paymentMethod([
            'payment_method' => 'card',
            'card_last4' => '9999',
        ]));
    }

    public function test_payment_method_handles_paypal_with_and_without_payer_email(): void
    {
        $this->assertSame('PayPal (buyer@example.com)', AdminOrderPresentation::paymentMethod([
            'payment_method' => 'paypal',
            'paypal_payer_email' => 'buyer@example.com',
        ]));

        $this->assertSame('PayPal', AdminOrderPresentation::paymentMethod([
            'payment_method' => 'paypal',
        ]));
    }

    public function test_payment_method_handles_cod_unknown_and_missing(): void
    {
        $this->assertSame('COD', AdminOrderPresentation::paymentMethod([
            'payment_method' => 'cod',
        ]));

        $this->assertSame('Bank Transfer', AdminOrderPresentation::paymentMethod([
            'payment_method' => 'bank_transfer',
        ]));

        $this->assertSame('—', AdminOrderPresentation::paymentMethod([]));
    }

    public function test_money_formatting_with_usd_fallback_and_explicit_currency(): void
    {
        $this->assertSame('USD $123.45', AdminOrderPresentation::money(12345));
        $this->assertSame('USD $123.45', AdminOrderPresentation::money(123.45));
        $this->assertSame('USD $123.45', AdminOrderPresentation::money(12345, null));
        $this->assertSame('EUR €123.45', AdminOrderPresentation::money(123.45, 'EUR'));
        $this->assertSame('GBP £123.45', AdminOrderPresentation::money(123.45, 'GBP'));
        $this->assertSame('USD $0.00', AdminOrderPresentation::money(0));

        $priceObject = (object) ['value' => 1250];
        $this->assertSame('USD $12.50', AdminOrderPresentation::money($priceObject));
    }

    public function test_product_quantity_excludes_shipping_lines(): void
    {
        $lines = [
            (object) ['type' => 'product', 'quantity' => 3],
            (object) ['type' => 'product', 'quantity' => 2],
            (object) ['type' => 'shipping', 'quantity' => 1],
        ];

        $this->assertSame(5, AdminOrderPresentation::productQuantity($lines));

        $arrayLines = [
            ['type' => 'product', 'quantity' => 4],
            ['type' => 'shipping', 'quantity' => 2],
        ];

        $this->assertSame(4, AdminOrderPresentation::productQuantity($arrayLines));

        $this->assertSame(0, AdminOrderPresentation::productQuantity([]));
    }
}
