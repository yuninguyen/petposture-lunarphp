<?php

namespace Tests\Feature\Api\Admin;

use App\Models\BlogTag;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class BlogTagControllerTest extends TestCase
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
        $this->getJson('/api/admin/blog/tags')->assertUnauthorized();
    }

    public function test_customer_role_cannot_list_tags(): void
    {
        $user = User::factory()->create();
        $user->assignRole('customer');
        Sanctum::actingAs($user);

        $this->getJson('/api/admin/blog/tags')->assertForbidden();
    }

    public function test_admin_gets_all_tags_as_bare_array(): void
    {
        $user = User::factory()->create();
        $user->assignRole('admin');
        Sanctum::actingAs($user);

        BlogTag::create(['name' => 'Zulu', 'slug' => 'zulu']);
        BlogTag::create(['name' => 'Alpha', 'slug' => 'alpha']);

        $response = $this->getJson('/api/admin/blog/tags')->assertOk();

        $this->assertCount(2, $response->json());
        $this->assertSame('Alpha', $response->json('0.name'));
        $this->assertArrayHasKey('id', $response->json('0'));
        $this->assertArrayHasKey('slug', $response->json('0'));
    }
}
