<?php

namespace Tests\Feature;

use App\Payments\Gateways\AffirmGateway;
use App\Payments\Gateways\CashAppPayGateway;
use App\Payments\Gateways\KlarnaGateway;
use App\Payments\PaymentGatewayManager;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use InvalidArgumentException;
use Tests\TestCase;

class StripeAltGatewaysTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        config()->set('services.stripe.key', 'pk_test_alt_methods');
        config()->set('services.stripe.secret', 'sk_test_alt_methods');
        config()->set('services.stripe.alt_methods', []);
        Cache::forget('stripe_key');
        Cache::forget('stripe_secret');
    }

    public function test_alternative_methods_are_listed_but_disabled_when_the_environment_allowlist_is_empty(): void
    {
        $response = $this->getJson('/api/checkout/payment-methods');

        $response->assertOk();
        $methods = collect($response->json('methods'))->keyBy('method');

        foreach (['cashapp', 'affirm', 'klarna'] as $method) {
            $this->assertFalse($methods->get($method)['enabled'] ?? true);
            $this->assertSame('stripe', $methods->get($method)['gateway'] ?? null);
            $this->assertSame('redirect', $methods->get($method)['collection'] ?? null);
        }
    }

    public function test_only_allowlisted_methods_are_enabled_when_stripe_is_configured(): void
    {
        config()->set('services.stripe.alt_methods', ['cashapp', 'affirm']);

        $response = $this->getJson('/api/checkout/payment-methods');

        $response->assertOk();
        $methods = collect($response->json('methods'))->keyBy('method');
        $this->assertTrue($methods->get('cashapp')['enabled']);
        $this->assertTrue($methods->get('affirm')['enabled']);
        $this->assertFalse($methods->get('klarna')['enabled']);
        $this->assertSame('configured', $methods->get('cashapp')['mode']);
    }

    public function test_allowlisted_methods_remain_disabled_without_both_stripe_keys(): void
    {
        config()->set('services.stripe.alt_methods', ['affirm']);
        config()->set('services.stripe.secret', null);
        Cache::forget('stripe_secret');

        $response = $this->getJson('/api/checkout/payment-methods');

        $response->assertOk();
        $affirm = collect($response->json('methods'))->firstWhere('method', 'affirm');
        $this->assertFalse($affirm['enabled']);
        $this->assertSame('placeholder', $affirm['mode']);
    }

    public function test_for_method_rejects_disabled_methods_and_returns_an_enabled_gateway(): void
    {
        $manager = app(PaymentGatewayManager::class);

        try {
            $manager->forMethod('affirm');
            $this->fail('A disabled Stripe method must not be selectable.');
        } catch (InvalidArgumentException $exception) {
            $this->assertStringContainsString('affirm', $exception->getMessage());
        }

        config()->set('services.stripe.alt_methods', ['affirm']);
        $this->assertInstanceOf(AffirmGateway::class, app(PaymentGatewayManager::class)->forMethod('affirm'));
    }

    public function test_each_alternative_gateway_prepares_stripe_redirect_meta_from_the_session_context(): void
    {
        config()->set('services.stripe.alt_methods', ['cashapp', 'affirm', 'klarna']);
        $manager = app(PaymentGatewayManager::class);
        $definitions = collect($manager->supportedMethods())->keyBy('method');
        $this->assertSame(50, $definitions->get('cashapp')['min_amount_minor']);
        $this->assertNull($definitions->get('cashapp')['max_amount_minor']);
        $this->assertSame(3500, $definitions->get('affirm')['min_amount_minor']);
        $this->assertSame(3_000_000, $definitions->get('affirm')['max_amount_minor']);
        $this->assertSame(0, $definitions->get('klarna')['min_amount_minor']);
        $this->assertSame(400_000, $definitions->get('klarna')['max_amount_minor']);

        foreach ([
            'cashapp' => CashAppPayGateway::class,
            'affirm' => AffirmGateway::class,
            'klarna' => KlarnaGateway::class,
        ] as $method => $class) {
            $gateway = $manager->forMethod($method);
            $this->assertInstanceOf($class, $gateway);

            $prepared = $gateway->prepare([
                'payment_context' => ['intent_id' => 'pi_'.$method, 'session_id' => 'STRIPE-'.$method],
            ]);

            $this->assertSame('stripe', $prepared->gateway);
            $this->assertSame('redirect', $prepared->collectionType);
            $this->assertSame('pending', $prepared->paymentStatus);
            $this->assertSame('pi_'.$method, $prepared->meta['payment_intent_id']);
            $this->assertSame('STRIPE-'.$method, $prepared->meta['stripe_session_id']);
        }
    }
}
