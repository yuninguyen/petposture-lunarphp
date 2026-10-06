<?php

namespace Tests\Unit;

use Tests\TestCase;

class PaymentMethodEmailPartialTest extends TestCase
{
    private function render(array $meta): string
    {
        $order = (object) ['meta' => $meta, 'total' => 3771, 'currency_code' => 'USD'];

        return preg_replace('/\s+/', ' ', strip_tags(view('mail.partials.payment-method', ['order' => $order, 'amount' => 37.71])->render()));
    }

    public function test_a_wallet_order_names_the_wallet_even_before_the_card_is_known(): void
    {
        $text = $this->render(['payment_method' => 'airwallex', 'payment_label' => 'Card', 'payment_gateway' => 'airwallex', 'payment_wallet' => 'google_pay']);

        $this->assertStringContainsString('Google Pay', $text);
        $this->assertStringNotContainsString('Card', $text);
    }

    public function test_a_wallet_order_shows_the_underlying_card_once_known(): void
    {
        $text = $this->render(['payment_method' => 'airwallex', 'payment_wallet' => 'apple_pay', 'card_brand' => 'visa', 'card_last4' => '0008']);

        $this->assertStringContainsString('Apple Pay', $text);
        $this->assertStringContainsString('Visa', $text);
        $this->assertStringContainsString('0008', $text);
    }

    public function test_a_plain_card_order_is_unchanged(): void
    {
        $text = $this->render(['payment_method' => 'card', 'card_brand' => 'visa', 'card_last4' => '4242']);

        $this->assertStringNotContainsString('Pay', $text);
        $this->assertStringContainsString('4242', $text);
    }
}
