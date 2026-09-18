<?php

declare(strict_types=1);

namespace Tests\Feature\Api\Admin;

use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Lunar\Models\Brand;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

/**
 * Parity test suite for Phase 6b: Brands Domain Migration.
 *
 * Verifies exact 100% status code parity across all 7 roles and all 5 brand actions:
 * - Allowed (super_admin, admin, staff, Product Manager): 200, 201, 204.
 * - Blocked (Order Manager, Support, customer): 403 Forbidden.
 */
class BrandsAbilityParityTest extends TestCase
{
    use RefreshDatabase;

    private const ALLOWED_ROLES = [
        'super_admin',
        'admin',
        'staff',
        'Product Manager',
    ];

    private const BLOCKED_ROLES = [
        'Order Manager',
        'Support',
        'customer',
    ];

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
    }

    public function test_allowed_roles_can_list_brands(): void
    {
        Brand::query()->create(['name' => 'Parity Brand Alpha']);

        foreach (self::ALLOWED_ROLES as $role) {
            $user = $this->actingAsRole($role);

            $response = $this->getJson('/api/admin/brands');

            $response->assertOk(
                "Role '{$role}' must be permitted to list brands (GET /api/admin/brands)."
            );
        }
    }

    public function test_blocked_roles_cannot_list_brands(): void
    {
        Brand::query()->create(['name' => 'Parity Brand Alpha']);

        foreach (self::BLOCKED_ROLES as $role) {
            $this->actingAsRole($role);

            $response = $this->getJson('/api/admin/brands');

            $response->assertForbidden(
                "Role '{$role}' must be forbidden from listing brands (GET /api/admin/brands)."
            );
        }
    }

    public function test_allowed_roles_can_show_brand(): void
    {
        $brand = Brand::query()->create(['name' => 'Parity Brand Show']);

        foreach (self::ALLOWED_ROLES as $role) {
            $this->actingAsRole($role);

            $response = $this->getJson("/api/admin/brands/{$brand->id}");

            $response->assertOk(
                "Role '{$role}' must be permitted to show brand (GET /api/admin/brands/{$brand->id})."
            );
            $response->assertJsonPath('data.name', 'Parity Brand Show');
        }
    }

    public function test_blocked_roles_cannot_show_brand(): void
    {
        $brand = Brand::query()->create(['name' => 'Parity Brand Show']);

        foreach (self::BLOCKED_ROLES as $role) {
            $this->actingAsRole($role);

            $response = $this->getJson("/api/admin/brands/{$brand->id}");

            $response->assertForbidden(
                "Role '{$role}' must be forbidden from showing brand (GET /api/admin/brands/{$brand->id})."
            );
        }
    }

    public function test_allowed_roles_can_create_brand(): void
    {
        $counter = 1;
        foreach (self::ALLOWED_ROLES as $role) {
            $this->actingAsRole($role);

            $brandName = "Brand Created By {$role} {$counter}";
            $counter++;

            $response = $this->postJson('/api/admin/brands', [
                'name' => $brandName,
            ]);

            $response->assertCreated(
                "Role '{$role}' must be permitted to create brand (POST /api/admin/brands)."
            );
            $response->assertJsonPath('data.name', $brandName);

            $this->assertDatabaseHas('lunar_brands', [
                'name' => $brandName,
            ]);
        }
    }

    public function test_blocked_roles_cannot_create_brand(): void
    {
        foreach (self::BLOCKED_ROLES as $role) {
            $this->actingAsRole($role);

            $response = $this->postJson('/api/admin/brands', [
                'name' => "Unauthorized Brand {$role}",
            ]);

            $response->assertForbidden(
                "Role '{$role}' must be forbidden from creating brand (POST /api/admin/brands)."
            );
        }
    }

    public function test_allowed_roles_can_update_brand(): void
    {
        $brand = Brand::query()->create(['name' => 'Initial Brand Update Name']);
        $counter = 1;

        foreach (self::ALLOWED_ROLES as $role) {
            $this->actingAsRole($role);

            $newName = "Brand Updated By {$role} {$counter}";
            $counter++;

            $response = $this->putJson("/api/admin/brands/{$brand->id}", [
                'name' => $newName,
            ]);

            $response->assertOk(
                "Role '{$role}' must be permitted to update brand (PUT /api/admin/brands/{$brand->id})."
            );
            $response->assertJsonPath('data.name', $newName);

            $this->assertDatabaseHas('lunar_brands', [
                'id' => $brand->id,
                'name' => $newName,
            ]);
        }
    }

    public function test_blocked_roles_cannot_update_brand(): void
    {
        $brand = Brand::query()->create(['name' => 'Initial Brand Protected Name']);

        foreach (self::BLOCKED_ROLES as $role) {
            $this->actingAsRole($role);

            $response = $this->putJson("/api/admin/brands/{$brand->id}", [
                'name' => "Tampered By {$role}",
            ]);

            $response->assertForbidden(
                "Role '{$role}' must be forbidden from updating brand (PUT /api/admin/brands/{$brand->id})."
            );
        }
    }

    public function test_allowed_roles_can_delete_unused_brand(): void
    {
        foreach (self::ALLOWED_ROLES as $role) {
            $this->actingAsRole($role);

            $brand = Brand::query()->create(['name' => "Brand To Delete By {$role}"]);

            $response = $this->deleteJson("/api/admin/brands/{$brand->id}");

            $response->assertNoContent();

            $this->assertDatabaseMissing('lunar_brands', [
                'id' => $brand->id,
            ]);
        }
    }

    public function test_blocked_roles_cannot_delete_unused_brand(): void
    {
        $brand = Brand::query()->create(['name' => 'Brand Protected From Deletion']);

        foreach (self::BLOCKED_ROLES as $role) {
            $this->actingAsRole($role);

            $response = $this->deleteJson("/api/admin/brands/{$brand->id}");

            $response->assertForbidden(
                "Role '{$role}' must be forbidden from deleting brand (DELETE /api/admin/brands/{$brand->id})."
            );

            $this->assertDatabaseHas('lunar_brands', [
                'id' => $brand->id,
            ]);
        }
    }

    public function test_migration_seeds_and_assigns_brand_permissions_to_existing_product_manager(): void
    {
        $migration = require database_path('migrations/2026_09_18_000001_seed_brands_domain_permissions.php');
        $migration->up();

        $pm = Role::query()->where('name', 'Product Manager')->where('guard_name', 'web')->first();
        $this->assertNotNull($pm);

        foreach (\App\Security\AdminAbilityRegistry::BRANDS as $permission) {
            $this->assertTrue(
                $pm->hasPermissionTo($permission),
                "Product Manager must have permission '{$permission}' after migration."
            );
        }
    }

    public function test_unauthenticated_request_is_unauthorized_for_all_endpoints(): void
    {
        $brand = Brand::query()->create(['name' => 'Guest Brand']);

        $this->getJson('/api/admin/brands')->assertUnauthorized();
        $this->postJson('/api/admin/brands', ['name' => 'Guest New'])->assertUnauthorized();
        $this->getJson("/api/admin/brands/{$brand->id}")->assertUnauthorized();
        $this->putJson("/api/admin/brands/{$brand->id}", ['name' => 'Guest Edit'])->assertUnauthorized();
        $this->deleteJson("/api/admin/brands/{$brand->id}")->assertUnauthorized();
    }

    private function actingAsRole(string $role): User
    {
        $user = User::factory()->create();
        $user->assignRole($role);
        Sanctum::actingAs($user);

        return $user;
    }
}
