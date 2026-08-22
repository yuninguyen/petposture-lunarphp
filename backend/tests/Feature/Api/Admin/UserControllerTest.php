<?php

namespace Tests\Feature\Api\Admin;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class UserControllerTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Role::firstOrCreate(['name' => 'admin', 'guard_name' => 'web']);
        Role::firstOrCreate(['name' => 'customer', 'guard_name' => 'web']);
    }

    public function test_unauthenticated_request_is_rejected(): void
    {
        $this->getJson('/api/admin/users')->assertUnauthorized();
    }

    public function test_customer_role_cannot_list_users(): void
    {
        $user = User::factory()->create();
        $user->assignRole('customer');
        Sanctum::actingAs($user);

        $this->getJson('/api/admin/users')->assertForbidden();
    }

    public function test_admin_gets_user_names_as_bare_array(): void
    {
        $admin = User::factory()->create(['name' => 'Zulu Admin']);
        $admin->assignRole('admin');
        Sanctum::actingAs($admin);

        User::factory()->create(['name' => 'Alpha Author']);

        $response = $this->getJson('/api/admin/users')->assertOk();

        // 1 migration-seeded admin (create_production_admin_user) + 2 factory users
        $this->assertCount(3, $response->json());
        $this->assertSame('Alpha Author', $response->json('0.name'));
        $this->assertArrayHasKey('id', $response->json('0'));
    }
}
