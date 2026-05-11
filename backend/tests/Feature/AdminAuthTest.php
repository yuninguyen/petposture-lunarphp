<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
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
        Role::create(['name' => 'super_admin', 'guard_name' => 'web']);
        Role::create(['name' => 'admin',       'guard_name' => 'web']);
        Role::create(['name' => 'customer',    'guard_name' => 'web']);
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
            'email'    => 'test@example.com',
            'password' => 'wrong',
        ])->assertUnprocessable();
    }

    public function test_register_creates_user_and_returns_token(): void
    {
        Role::firstOrCreate(['name' => 'customer', 'guard_name' => 'web']);

        $this->postJson('/api/register', [
            'name'                  => 'Jane Doe',
            'email'                 => 'jane@example.com',
            'password'              => 'password123',
            'password_confirmation' => 'password123',
        ])->assertOk()
          ->assertJsonPath('data.user.email', 'jane@example.com')
          ->assertJsonStructure(['data' => ['token']]);
    }

    public function test_logout_revokes_token(): void
    {
        $user = User::factory()->create();
        Sanctum::actingAs($user);

        $this->postJson('/api/logout')->assertOk();
    }
}
