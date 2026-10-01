<?php

namespace Tests\Feature;

use App\Services\StripePaymentIntentService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class StripeAltPaymentIntentTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        config()->set('services.stripe.secret', 'sk_test_alt_methods');
        config()->set('services.stripe.key', 'pk_test_alt_methods');
        Cache::forget('stripe_secret');
        Cache::forget('stripe_key');
    }

    public function test_card_payment_intent_keeps_the_existing_request_payload(): void
    {
        Http::fake([
            'https://api.stripe.com/v1/payment_intents' => Http::response([
                'id' => 'pi_card_123',
                'client_secret' => 'pi_card_123_secret',
                'amount' => 4200,
                'currency' => 'usd',
                'status' => 'requires_payment_method',
            ]),
        ]);

        app(StripePaymentIntentService::class)->create([
            'amount' => 4200,
            'currency' => 'usd',
            'email' => 'card@example.com',
        ]);

        Http::assertSent(fn ($request): bool => $request->url() === 'https://api.stripe.com/v1/payment_intents'
            && $request->data() === [
                'amount' => 4200,
                'currency' => 'usd',
                'receipt_email' => 'card@example.com',
                'automatic_payment_methods[enabled]' => 'true',
                'metadata[source]' => 'petposture-checkout',
                'metadata[email]' => 'card@example.com',
            ]);
    }

    public function test_alternative_payment_intent_uses_explicit_method_shipping_and_billing_details(): void
    {
        Http::fake([
            'https://api.stripe.com/v1/payment_intents' => Http::response([
                'id' => 'pi_affirm_123',
                'client_secret' => 'pi_affirm_123_secret',
                'amount' => 4200,
                'currency' => 'usd',
                'status' => 'requires_action',
            ]),
        ]);

        app(StripePaymentIntentService::class)->create([
            'amount' => 4200,
            'currency' => 'usd',
            'email' => 'buyer@example.com',
            'payment_method_types' => ['affirm'],
            'shipping' => [
                'name' => 'Buyer Example',
                'line1' => '1 Main St',
                'city' => 'Austin',
                'state' => 'TX',
                'postal_code' => '78701',
                'country' => 'US',
            ],
            'billing' => [
                'name' => 'Buyer Example',
                'line1' => '1 Main St',
                'city' => 'Austin',
                'state' => 'TX',
                'postal_code' => '78701',
                'country' => 'US',
                'email' => 'buyer@example.com',
                'phone' => '5125550100',
            ],
            'metadata' => ['source' => 'petposture-checkout', 'payment_method' => 'affirm'],
        ]);

        Http::assertSent(fn ($request): bool => $request->url() === 'https://api.stripe.com/v1/payment_intents'
            && $request['payment_method_types[0]'] === 'affirm'
            && $request['shipping[address][line1]'] === '1 Main St'
            && $request['payment_method_data[type]'] === 'affirm'
            && $request['payment_method_data[billing_details][email]'] === 'buyer@example.com'
            && $request['metadata[payment_method]'] === 'affirm'
            && ! array_key_exists('automatic_payment_methods[enabled]', $request->data()));
    }

    public function test_billing_details_without_an_explicit_method_type_are_not_sent_to_stripe(): void
    {
        Http::fake([
            'https://api.stripe.com/v1/payment_intents' => Http::response([
                'id' => 'pi_plain_1',
                'client_secret' => 'pi_plain_1_secret',
                'amount' => 4200,
                'currency' => 'usd',
                'status' => 'requires_payment_method',
            ]),
        ]);

        app(StripePaymentIntentService::class)->create([
            'amount' => 4200,
            'currency' => 'usd',
            'billing' => ['name' => 'Buyer Example', 'email' => 'buyer@example.com'],
        ]);

        // Stripe answers "Missing required param: payment_method_data[type]"
        // to payment_method_data[...] without a type; never send it untyped.
        Http::assertSent(fn ($request): bool => $request->url() === 'https://api.stripe.com/v1/payment_intents'
            && ! array_key_exists('payment_method_data[billing_details][email]', $request->data())
            && ! array_key_exists('payment_method_data[type]', $request->data()));
    }
}
