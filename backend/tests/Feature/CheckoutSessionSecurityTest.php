<?php

namespace Tests\Feature;

use App\Models\CheckoutSession;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class CheckoutSessionSecurityTest extends TestCase
{
    use RefreshDatabase;

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

    public function test_matching_guest_proof_can_read_and_update_its_session(): void
    {
        $createResponse = $this->createGuestSession('owner@example.com');
        $token = (string) $createResponse->json('session.token');
        $cookieName = $this->proofCookieName($token);
        $proof = (string) $createResponse->getCookie($cookieName, false)->getValue();

        $this->withCredentials()->withUnencryptedCookie($cookieName, $proof)
            ->getJson("/api/checkout/session/{$token}")
            ->assertOk()
            ->assertJsonPath('session.payload.shipping.email', 'owner@example.com');

        $this->withCredentials()->withUnencryptedCookie($cookieName, $proof)
            ->postJson('/api/checkout/session', [
                'token' => $token,
                'customer_note' => 'Updated by the owner',
            ])
            ->assertOk()
            ->assertJsonPath('session.payload.customer_note', 'Updated by the owner');
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
