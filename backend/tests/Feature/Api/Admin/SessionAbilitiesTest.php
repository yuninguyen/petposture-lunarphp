<?php

declare(strict_types=1);

namespace Tests\Feature\Api\Admin;

use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Phase 6c: GET /api/admin/session exposes the current user's real Spatie
 * permission names as `abilities`, so the frontend can gate UI without
 * hardcoding role names. Purely additive — no existing behavior changed.
 */
class SessionAbilitiesTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
    }

    public function test_core_admin_receives_every_registered_ability(): void
    {
        $user = $this->actingAsRole('admin');

        $response = $this->getJson('/api/admin/session');

        $response->assertOk();
        $abilities = $response->json('data.abilities');
        $this->assertIsArray($abilities);
        $this->assertContains('view_any_brand', $abilities);
        $this->assertContains('refund_order', $abilities);
        $this->assertContains('update_smtp_settings', $abilities);
        $this->assertSame($user->getAllPermissions()->pluck('name')->sort()->values()->all(), collect($abilities)->sort()->values()->all());
    }

    public function test_business_role_receives_only_its_granted_abilities(): void
    {
        $this->actingAsRole('Product Manager');

        $response = $this->getJson('/api/admin/session');

        $response->assertOk();
        $abilities = $response->json('data.abilities');
        $this->assertContains('view_any_brand', $abilities);
        $this->assertNotContains('view_any_customer', $abilities);
        $this->assertNotContains('refund_order', $abilities);
    }

    public function test_unauthenticated_request_is_unauthorized(): void
    {
        $this->getJson('/api/admin/session')->assertUnauthorized();
    }

    private function actingAsRole(string $role): User
    {
        $user = User::factory()->create();
        $user->assignRole($role);
        Sanctum::actingAs($user);

        return $user;
    }
}
