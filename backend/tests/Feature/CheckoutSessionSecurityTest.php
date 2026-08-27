<?php

namespace Tests\Feature;

use App\Models\CheckoutSession;
use App\Models\User;
use App\Services\CheckoutService;
use App\Services\ShippingService;
use App\Services\StripePaymentIntentService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Lunar\Models\Channel;
use Lunar\Models\Order;
use Tests\TestCase;

class CheckoutSessionSecurityTest extends TestCase
{
    use RefreshDatabase;

    public function test_new_checkout_session_starts_open(): void
    {
        $this->postJson('/api/checkout/session', [])
            ->assertOk()
            ->assertJsonPath('session.status', 'open');
    }

    public function test_guest_session_creation_sets_a_session_specific_proof_cookie_and_stores_only_its_hash(): void
    {
        $response = $this->postJson('/api/checkout/session', []);

        $response->assertOk();

        $token = (string) $response->json('session.token');
        $cookieName = 'checkout_session_proof_'.substr(hash('sha256', $token), 0, 16);

        $response->assertCookie($cookieName);

        $session = CheckoutSession::query()->where('token', $token)->firstOrFail();
        $cookieValue = (string) $response->getCookie($cookieName, false)?->getValue();
        [$proof, $signature] = array_pad(explode('.', $cookieValue, 2), 2, null);

        $this->assertNotNull($session->guest_proof_hash);
        $this->assertMatchesRegularExpression('/^[a-f0-9]{64}$/', $session->guest_proof_hash);
        $this->assertNotNull($signature, 'Guest proof cookie must be HMAC signed.');
        $this->assertSame(hash_hmac('sha256', $proof, app('encrypter')->getKey()), $signature);
        $this->assertSame(hash('sha256', $proof), $session->guest_proof_hash);
    }

    public function test_token_only_get_returns_minimal_non_sensitive_status(): void
    {
        $createResponse = $this->createGuestSession('guest@example.com');
        $token = (string) $createResponse->json('session.token');

        $response = $this->getJson("/api/checkout/session/{$token}");

        $this->assertMinimalSessionStatus($response);
    }

    public function test_owner_reads_and_api_aliases_do_not_serialize_checkout_secrets_or_pii(): void
    {
        $createResponse = $this->createGuestSession('private@example.com');
        $token = (string) $createResponse->json('session.token');
        $cookieName = $this->proofCookieName($token);
        $proof = (string) $createResponse->getCookie($cookieName, false)->getValue();

        foreach (['/api', '/api/v1'] as $prefix) {
            $response = $this->withCredentials()
                ->withUnencryptedCookie($cookieName, $proof)
                ->getJson("{$prefix}/checkout/session/{$token}");

            $response->assertOk();
            $this->assertSessionHasNoSensitiveFields($response);
        }
    }

    public function test_payment_mutations_require_an_idempotency_key(): void
    {
        $createResponse = $this->createGuestSession('idempotency@example.com');
        $token = (string) $createResponse->json('session.token');
        $cookieName = $this->proofCookieName($token);
        $proof = (string) $createResponse->getCookie($cookieName, false)->getValue();

        $this->withCredentials()->withUnencryptedCookie($cookieName, $proof)
            ->postJson("/api/checkout/session/{$token}/payment-intent")
            ->assertUnprocessable()
            ->assertJsonValidationErrors('idempotency_key');

        $this->withCredentials()->withUnencryptedCookie($cookieName, $proof)
            ->postJson("/api/checkout/session/{$token}/confirm")
            ->assertUnprocessable()
            ->assertJsonValidationErrors('idempotency_key');
    }

    public function test_payment_intent_retry_with_same_key_reuses_the_original_intent(): void
    {
        $this->mock(CheckoutService::class, function ($mock): void {
            $mock->shouldReceive('calculateTotal')->once()->andReturn(1000);
            $mock->shouldReceive('subtotalFor')->once()->andReturn(1000);
        });
        $this->mock(ShippingService::class, function ($mock): void {
            $mock->shouldReceive('rateFor')->once()->andReturn(0);
        });
        $this->mock(StripePaymentIntentService::class, function ($mock): void {
            $mock->shouldReceive('create')
                ->once()
                ->with(\Mockery::on(fn (array $payload): bool => str_starts_with(
                    (string) ($payload['idempotency_key'] ?? ''),
                    'checkout-session:',
                ) && str_ends_with(
                    (string) $payload['idempotency_key'],
                    ':payment-intent:'.hash('sha256', 'payment-key-123'),
                )))
                ->andReturn([
                    'intent_id' => 'pi_idempotent_123',
                    'client_secret' => 'pi_idempotent_123_secret',
                    'amount' => 1000,
                    'currency' => 'USD',
                    'status' => 'requires_payment_method',
                    'mode' => 'configured',
                    'gateway' => 'stripe',
                    'publishable_key' => 'pk_test',
                ]);
        });

        [$session, $cookieName, $proof] = $this->persistGuestSession([
            'items' => [['variantId' => 123, 'quantity' => 1]],
            'shipping' => ['email' => 'payment@example.com'],
        ]);

        $first = $this->withCredentials()
            ->withHeader('Idempotency-Key', 'payment-key-123')
            ->withUnencryptedCookie($cookieName, $proof)
            ->postJson("/api/checkout/session/{$session->token}/payment-intent");

        $first->assertOk()
            ->assertJsonPath('payment_intent.intent_id', 'pi_idempotent_123')
            ->assertJsonPath('payment_intent.client_secret', 'pi_idempotent_123_secret')
            ->assertJsonPath('session.status', 'payment_pending');
        $this->assertSessionHasNoSensitiveFields($first);

        $second = $this->withCredentials()
            ->withHeader('Idempotency-Key', 'payment-key-123')
            ->withUnencryptedCookie($cookieName, $proof)
            ->postJson("/api/checkout/session/{$session->token}/payment-intent");

        $second->assertOk()
            ->assertJsonPath('payment_intent.intent_id', 'pi_idempotent_123')
            ->assertJsonPath('payment_intent.client_secret', 'pi_idempotent_123_secret')
            ->assertJsonPath('session.status', 'payment_pending');
        $this->assertSessionHasNoSensitiveFields($second);

        $this->withCredentials()
            ->withHeader('Idempotency-Key', 'different-payment-key')
            ->withUnencryptedCookie($cookieName, $proof)
            ->postJson("/api/checkout/session/{$session->token}/payment-intent")
            ->assertConflict();

        $this->assertSame(
            hash('sha256', 'payment-key-123'),
            $session->fresh()->payment_intent_idempotency_key_hash,
        );
    }

    public function test_stripe_requests_use_the_scoped_provider_idempotency_key_and_server_side_retrieval(): void
    {
        config()->set('services.stripe.secret', 'sk_test_checkout');
        config()->set('services.stripe.key', 'pk_test_checkout');
        Cache::forget('stripe_secret');
        Cache::forget('stripe_key');
        Http::fake([
            'https://api.stripe.com/v1/payment_intents' => Http::response([
                'id' => 'pi_http_123',
                'client_secret' => 'pi_http_123_secret',
                'amount' => 1000,
                'currency' => 'usd',
                'status' => 'requires_payment_method',
            ]),
            'https://api.stripe.com/v1/payment_intents/pi_http_123' => Http::response([
                'id' => 'pi_http_123',
                'amount' => 1000,
                'currency' => 'usd',
                'status' => 'succeeded',
            ]),
        ]);

        $service = app(StripePaymentIntentService::class);
        $service->create([
            'amount' => 1000,
            'currency' => 'usd',
            'email' => 'stripe@example.com',
            'idempotency_key' => 'checkout-session:42:payment-intent:key-hash',
        ]);
        $retrieved = $service->retrieve('pi_http_123');

        $this->assertSame('succeeded', $retrieved['status']);
        Http::assertSent(fn (Request $request): bool => $request->method() === 'POST'
            && $request->url() === 'https://api.stripe.com/v1/payment_intents'
            && $request->hasHeader('Idempotency-Key', 'checkout-session:42:payment-intent:key-hash'));
        Http::assertSent(fn (Request $request): bool => $request->method() === 'GET'
            && $request->url() === 'https://api.stripe.com/v1/payment_intents/pi_http_123');
    }

    public function test_session_payload_cannot_change_after_payment_preparation_starts(): void
    {
        [$session, $cookieName, $proof] = $this->persistGuestSession([
            'shipping' => ['email' => 'locked@example.com'],
        ]);
        $session->update(['status' => 'payment_pending']);

        $this->withCredentials()
            ->withUnencryptedCookie($cookieName, $proof)
            ->postJson('/api/checkout/session', [
                'token' => $session->token,
                'shipping' => ['email' => 'tampered@example.com'],
            ])
            ->assertConflict();

        $this->assertSame('locked@example.com', $session->fresh()->payload['shipping']['email']);
    }

    public function test_confirm_rejects_payment_that_is_not_provider_confirmed(): void
    {
        $this->mock(CheckoutService::class, function ($mock): void {
            $mock->shouldNotReceive('placeOrder');
        });
        $this->mock(StripePaymentIntentService::class, function ($mock): void {
            $mock->shouldReceive('retrieve')->once()->with('pi_pending_123')->andReturn([
                'intent_id' => 'pi_pending_123',
                'status' => 'requires_action',
            ]);
        });

        [$session, $cookieName, $proof] = $this->persistGuestSession([
            'items' => [['variantId' => 123, 'quantity' => 1]],
            'shipping' => ['email' => 'pending@example.com'],
            'payment_method' => 'card',
        ]);
        $session->update([
            'status' => 'payment_pending',
            'payment_intent_id' => 'pi_pending_123',
        ]);
        $orderCount = Order::query()->count();

        $this->withCredentials()
            ->withHeader('Idempotency-Key', 'confirm-pending-123')
            ->withUnencryptedCookie($cookieName, $proof)
            ->postJson("/api/checkout/session/{$session->token}/confirm")
            ->assertConflict();

        $this->assertSame($orderCount, Order::query()->count());
        $this->assertSame('payment_pending', $session->fresh()->status);
    }

    public function test_successful_confirm_rotates_token_and_same_key_replay_returns_one_order(): void
    {
        $channel = Channel::query()->firstOrCreate([
            'handle' => 'checkout-test',
        ], [
            'name' => 'Checkout Test',
            'default' => true,
        ]);
        $this->mock(CheckoutService::class, function ($mock) use ($channel): void {
            $mock->shouldReceive('placeOrder')->once()->andReturnUsing(function () use ($channel): Order {
                $orderId = DB::table('lunar_orders')->insertGetId([
                    'channel_id' => $channel->id,
                    'status' => 'awaiting-payment',
                    'reference' => 'PP-IDEMPOTENT-001',
                    'customer_reference' => 'confirmed@example.com',
                    'sub_total' => 1000,
                    'discount_total' => 0,
                    'shipping_total' => 0,
                    'tax_breakdown' => '[]',
                    'tax_total' => 0,
                    'total' => 1000,
                    'currency_code' => 'USD',
                    'exchange_rate' => 1,
                    'meta' => json_encode(['payment_status' => 'paid']),
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);

                return Order::query()->findOrFail($orderId);
            });
        });
        $this->mock(StripePaymentIntentService::class, function ($mock): void {
            $mock->shouldReceive('retrieve')->once()->with('pi_succeeded_123')->andReturn([
                'intent_id' => 'pi_succeeded_123',
                'status' => 'succeeded',
            ]);
        });

        [$session, $cookieName, $proof] = $this->persistGuestSession([
            'items' => [['variantId' => 123, 'quantity' => 1]],
            'shipping' => ['email' => 'confirmed@example.com'],
            'payment_method' => 'card',
        ]);
        $session->update([
            'status' => 'payment_pending',
            'payment_intent_id' => 'pi_succeeded_123',
        ]);
        $oldToken = $session->token;

        $first = $this->withCredentials()
            ->withHeader('Idempotency-Key', 'confirm-key-123')
            ->withUnencryptedCookie($cookieName, $proof)
            ->postJson("/api/checkout/session/{$oldToken}/confirm");

        $first->assertCreated()
            ->assertJsonPath('order.reference', 'PP-IDEMPOTENT-001')
            ->assertJsonPath('session.status', 'consumed');
        $this->assertSessionHasNoSensitiveFields($first);

        $rotatedSession = $session->fresh();
        $this->assertNotSame($oldToken, $rotatedSession->token);
        $this->assertSame(hash('sha256', $oldToken), $rotatedSession->previous_token_hash);
        $this->assertSame(hash('sha256', 'confirm-key-123'), $rotatedSession->confirm_idempotency_key_hash);

        $second = $this->withCredentials()
            ->withHeader('Idempotency-Key', 'confirm-key-123')
            ->withUnencryptedCookie($cookieName, $proof)
            ->postJson("/api/checkout/session/{$oldToken}/confirm");

        $second->assertCreated()
            ->assertJsonPath('order.reference', 'PP-IDEMPOTENT-001')
            ->assertJsonPath('session.status', 'consumed');
        $this->assertSessionHasNoSensitiveFields($second);

        $this->withCredentials()
            ->withHeader('Idempotency-Key', 'different-confirm-key')
            ->withUnencryptedCookie($cookieName, $proof)
            ->postJson("/api/checkout/session/{$oldToken}/confirm")
            ->assertConflict();

        $this->assertSame(1, Order::query()->where('reference', 'PP-IDEMPOTENT-001')->count());
        $this->getJson("/api/checkout/session/{$oldToken}")->assertNotFound();
    }

    public function test_matching_guest_proof_can_read_and_update_its_session(): void
    {
        $createResponse = $this->createGuestSession('owner@example.com');
        $token = (string) $createResponse->json('session.token');
        $cookieName = $this->proofCookieName($token);
        $proof = (string) $createResponse->getCookie($cookieName, false)->getValue();

        $getResponse = $this->withCredentials()->withUnencryptedCookie($cookieName, $proof)
            ->getJson("/api/checkout/session/{$token}")
            ->assertOk()
            ->assertJsonPath('session.status', 'open');
        $this->assertSessionHasNoSensitiveFields($getResponse);

        $updateResponse = $this->withCredentials()->withUnencryptedCookie($cookieName, $proof)
            ->postJson('/api/checkout/session', [
                'token' => $token,
                'customer_note' => 'Updated by the owner',
            ])
            ->assertOk()
            ->assertJsonPath('session.status', 'open');
        $this->assertSessionHasNoSensitiveFields($updateResponse);
        $this->assertSame(
            'Updated by the owner',
            CheckoutSession::query()->where('token', $token)->firstOrFail()->payload['customer_note'],
        );
    }

    public function test_session_b_proof_cannot_read_session_a_sensitive_data(): void
    {
        [$tokenA, $cookieNameA, $proofB] = $this->sessionAWithSessionBProof();

        $response = $this->withCredentials()->withUnencryptedCookie($cookieNameA, $proofB)
            ->getJson("/api/checkout/session/{$tokenA}");

        $this->assertMinimalSessionStatus($response);
    }

    public function test_session_b_proof_cannot_mutate_session_a_payment_state(): void
    {
        [$tokenA, $cookieNameA, $proofB] = $this->sessionAWithSessionBProof();

        $this->withCredentials()->withUnencryptedCookie($cookieNameA, $proofB)
            ->postJson('/api/checkout/session', [
                'token' => $tokenA,
                'shipping' => ['email' => 'attacker@example.com'],
            ])
            ->assertForbidden();

        $this->withCredentials()->withUnencryptedCookie($cookieNameA, $proofB)
            ->postJson("/api/checkout/session/{$tokenA}/payment-intent")
            ->assertForbidden();

        $this->withCredentials()->withUnencryptedCookie($cookieNameA, $proofB)
            ->postJson("/api/checkout/session/{$tokenA}/confirm")
            ->assertForbidden();
    }

    public function test_different_authenticated_user_cannot_read_or_mutate_owned_session(): void
    {
        $owner = User::factory()->create();
        $otherUser = User::factory()->create();
        Sanctum::actingAs($owner);

        $createResponse = $this->postJson('/api/checkout/session', []);
        $token = (string) $createResponse->json('session.token');

        Sanctum::actingAs($otherUser);

        $this->getJson("/api/checkout/session/{$token}")
            ->assertForbidden();

        $this->postJson("/api/checkout/session/{$token}/payment-intent")
            ->assertForbidden();

        $this->postJson("/api/checkout/session/{$token}/confirm")
            ->assertForbidden();
    }

    public function test_expired_session_is_gone_for_reads_and_mutations(): void
    {
        $createResponse = $this->createGuestSession('expired@example.com');
        $token = (string) $createResponse->json('session.token');
        $cookieName = $this->proofCookieName($token);
        $proof = (string) $createResponse->getCookie($cookieName, false)->getValue();

        CheckoutSession::query()->where('token', $token)->update([
            'expires_at' => now()->subMinute(),
        ]);

        $this->withCredentials()->withUnencryptedCookie($cookieName, $proof)
            ->getJson("/api/checkout/session/{$token}")
            ->assertGone();

        $this->withCredentials()->withUnencryptedCookie($cookieName, $proof)
            ->postJson("/api/checkout/session/{$token}/payment-intent")
            ->assertGone();

        $this->withCredentials()->withUnencryptedCookie($cookieName, $proof)
            ->postJson("/api/checkout/session/{$token}/confirm")
            ->assertGone();
    }

    private function persistGuestSession(array $payload): array
    {
        $token = (string) Str::uuid();
        $rawProof = Str::random(64);
        $signature = hash_hmac('sha256', $rawProof, app('encrypter')->getKey());
        $session = CheckoutSession::query()->create([
            'token' => $token,
            'guest_proof_hash' => hash('sha256', $rawProof),
            'status' => 'open',
            'payload' => $payload,
            'totals' => [],
            'currency' => 'USD',
            'expires_at' => now()->addHours(24),
        ]);

        return [
            $session,
            $this->proofCookieName($token),
            $rawProof.'.'.$signature,
        ];
    }

    private function sessionAWithSessionBProof(): array
    {
        $sessionA = $this->createGuestSession('session-a@example.com');
        $sessionB = $this->createGuestSession('session-b@example.com');
        $tokenA = (string) $sessionA->json('session.token');
        $tokenB = (string) $sessionB->json('session.token');

        return [
            $tokenA,
            $this->proofCookieName($tokenA),
            (string) $sessionB->getCookie($this->proofCookieName($tokenB), false)->getValue(),
        ];
    }

    private function createGuestSession(string $email)
    {
        return $this->postJson('/api/checkout/session', [
            'shipping' => [
                'email' => $email,
                'line_one' => '123 Main Street',
            ],
        ]);
    }

    private function proofCookieName(string $token): string
    {
        return 'checkout_session_proof_'.substr(hash('sha256', $token), 0, 16);
    }

    private function assertSessionHasNoSensitiveFields($response): void
    {
        $response->assertJsonMissingPath('session.payload')
            ->assertJsonMissingPath('session.payment_intent_id')
            ->assertJsonMissingPath('session.payment_client_secret')
            ->assertJsonMissingPath('session.order_reference');
    }

    private function assertMinimalSessionStatus($response): void
    {
        $response->assertOk()
            ->assertJsonStructure([
                'success',
                'session' => ['token', 'status', 'expires_at'],
            ])
            ->assertJsonMissingPath('session.payload')
            ->assertJsonMissingPath('session.totals')
            ->assertJsonMissingPath('session.payment_intent_id')
            ->assertJsonMissingPath('session.payment_client_secret')
            ->assertJsonMissingPath('session.order_reference');
    }
}
