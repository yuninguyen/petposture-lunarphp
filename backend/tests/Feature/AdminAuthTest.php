<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\PersonalAccessToken;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class AdminAuthTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        // Spatie requires roles table to exist
        Role::firstOrCreate(['name' => 'super_admin', 'guard_name' => 'web']);
        Role::firstOrCreate(['name' => 'admin',       'guard_name' => 'web']);
        Role::firstOrCreate(['name' => 'customer',    'guard_name' => 'web']);
    }

    public function test_unauthenticated_request_to_admin_posts_returns_401(): void
    {
        $this->getJson('/api/admin/posts')->assertUnauthorized();
        $this->postJson('/api/admin/posts', [])->assertUnauthorized();
        $this->deleteJson('/api/admin/posts/1')->assertUnauthorized();
    }

    public function test_customer_role_cannot_access_admin_posts(): void
    {
        $user = User::factory()->create();
        $user->assignRole('customer');
        Sanctum::actingAs($user);

        $this->getJson('/api/admin/posts')->assertForbidden();
        $this->postJson('/api/admin/posts', [])->assertForbidden();
    }

    public function test_admin_role_can_read_admin_posts(): void
    {
        $user = User::factory()->create();
        $user->assignRole('admin');
        Sanctum::actingAs($user);

        // Table might be empty — a 200 with empty data is what we want
        $this->getJson('/api/admin/posts')->assertOk();
    }

    public function test_login_requires_credentials(): void
    {
        $this->postJson('/api/login', [])
            ->assertUnprocessable();
    }

    public function test_login_with_wrong_password_returns_422(): void
    {
        User::factory()->create(['email' => 'test@example.com', 'password' => bcrypt('correct')]);

        $this->postJson('/api/login', [
            'email' => 'test@example.com',
            'password' => 'wrong',
        ])->assertUnprocessable();
    }

    public function test_login_creates_a_session_without_issuing_a_bearer_token(): void
    {
        $user = User::factory()->create([
            'email' => 'session@example.com',
            'password' => bcrypt('correct-password'),
        ]);

        $this->withHeader('Origin', 'http://localhost:3000')
            ->postJson('/api/login', [
                'email' => 'session@example.com',
                'password' => 'correct-password',
            ])->assertOk()
            ->assertJsonPath('data.user.email', 'session@example.com')
            ->assertJsonMissingPath('data.token');

        $this->assertAuthenticatedAs($user, 'web');
        $this->assertDatabaseCount('personal_access_tokens', 0);
    }

    public function test_register_creates_an_authenticated_session_without_a_bearer_token(): void
    {
        Role::firstOrCreate(['name' => 'customer', 'guard_name' => 'web']);

        $this->withHeader('Origin', 'http://localhost:3000')
            ->postJson('/api/register', [
                'name' => 'Jane Doe',
                'email' => 'jane@example.com',
                'password' => 'password123',
                'password_confirmation' => 'password123',
            ])->assertOk()
            ->assertJsonPath('data.user.email', 'jane@example.com')
            ->assertJsonMissingPath('data.token');

        $this->assertAuthenticated('web');
        $this->assertDatabaseCount('personal_access_tokens', 0);
    }

    public function test_legacy_bearer_tokens_cannot_authenticate_first_party_api_requests(): void
    {
        $user = User::factory()->create();
        $plainToken = 'legacy-token-secret';
        $token = PersonalAccessToken::query()->forceCreate([
            'tokenable_type' => User::class,
            'tokenable_id' => $user->id,
            'name' => 'Legacy token',
            'token' => hash('sha256', $plainToken),
            'abilities' => ['*'],
        ]);

        $this->withToken($token->getKey().'|'.$plainToken)
            ->getJson('/api/me')
            ->assertUnauthorized();
    }

    public function test_logout_invalidates_the_authenticated_session(): void
    {
        $user = User::factory()->create();
        $this->actingAs($user, 'web');

        $this->withHeader('Origin', 'http://localhost:3000')
            ->postJson('/api/logout')
            ->assertOk();

        $this->assertGuest('web');
    }
}
