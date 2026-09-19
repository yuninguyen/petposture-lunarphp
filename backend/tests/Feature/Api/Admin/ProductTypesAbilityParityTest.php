<?php

declare(strict_types=1);

namespace Tests\Feature\Api\Admin;

use App\Models\User;
use App\Security\AdminAbilityRegistry;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Lunar\Models\ProductType;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

/**
 * Parity test suite for Phase 6b: Product Types Domain Migration.
 *
 * Verifies exact 100% status code parity across all 7 roles and all product type actions:
 * - Allowed (super_admin, admin, staff, Product Manager): 200, 201, 204.
 * - Blocked (Order Manager, Support, customer): 403 Forbidden.
 */
class ProductTypesAbilityParityTest extends TestCase
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

    public function test_allowed_roles_can_list_product_types(): void
    {
        ProductType::query()->create(['name' => 'Parity Type Alpha']);

        foreach (self::ALLOWED_ROLES as $role) {
            $this->actingAsRole($role);

            $response = $this->getJson('/api/admin/product-types');

            $response->assertOk(
                "Role '{$role}' must be permitted to list product types (GET /api/admin/product-types)."
            );
        }
    }

    public function test_blocked_roles_cannot_list_product_types(): void
    {
        ProductType::query()->create(['name' => 'Parity Type Alpha']);

        foreach (self::BLOCKED_ROLES as $role) {
            $this->actingAsRole($role);

            $response = $this->getJson('/api/admin/product-types');

            $response->assertForbidden(
                "Role '{$role}' must be forbidden from listing product types (GET /api/admin/product-types)."
            );
        }
    }

    public function test_allowed_roles_can_show_product_type(): void
    {
        $type = ProductType::query()->create(['name' => 'Parity Type Show']);

        foreach (self::ALLOWED_ROLES as $role) {
            $this->actingAsRole($role);

            $response = $this->getJson("/api/admin/product-types/{$type->id}");

            $response->assertOk(
                "Role '{$role}' must be permitted to show product type (GET /api/admin/product-types/{$type->id})."
            );
            $response->assertJsonPath('data.name', 'Parity Type Show');
        }
    }

    public function test_blocked_roles_cannot_show_product_type(): void
    {
        $type = ProductType::query()->create(['name' => 'Parity Type Show']);

        foreach (self::BLOCKED_ROLES as $role) {
            $this->actingAsRole($role);

            $response = $this->getJson("/api/admin/product-types/{$type->id}");

            $response->assertForbidden(
                "Role '{$role}' must be forbidden from showing product type (GET /api/admin/product-types/{$type->id})."
            );
        }
    }

    public function test_allowed_roles_can_create_product_type(): void
    {
        $counter = 1;
        foreach (self::ALLOWED_ROLES as $role) {
            $this->actingAsRole($role);

            $typeName = "Type Created By {$role} {$counter}";
            $counter++;

            $response = $this->postJson('/api/admin/product-types', [
                'name' => $typeName,
            ]);

            $response->assertCreated(
                "Role '{$role}' must be permitted to create product type (POST /api/admin/product-types)."
            );
            $response->assertJsonPath('data.name', $typeName);

            $this->assertDatabaseHas('lunar_product_types', [
                'name' => $typeName,
            ]);
        }
    }

    public function test_blocked_roles_cannot_create_product_type(): void
    {
        $counter = 1;
        foreach (self::BLOCKED_ROLES as $role) {
            $this->actingAsRole($role);

            $typeName = "Unauthorized Type {$role} {$counter}";
            $counter++;

            $response = $this->postJson('/api/admin/product-types', [
                'name' => $typeName,
            ]);

            $response->assertForbidden(
                "Role '{$role}' must be forbidden from creating product type (POST /api/admin/product-types)."
            );

            $this->assertDatabaseMissing('lunar_product_types', [
                'name' => $typeName,
            ]);
        }
    }

    public function test_allowed_roles_can_update_product_type(): void
    {
        $type = ProductType::query()->create(['name' => 'Initial Type Update Name']);
        $counter = 1;

        foreach (self::ALLOWED_ROLES as $role) {
            $this->actingAsRole($role);

            $newName = "Type Updated By {$role} {$counter}";
            $counter++;

            $response = $this->putJson("/api/admin/product-types/{$type->id}", [
                'name' => $newName,
            ]);

            $response->assertOk(
                "Role '{$role}' must be permitted to update product type (PUT /api/admin/product-types/{$type->id})."
            );
            $response->assertJsonPath('data.name', $newName);

            $this->assertDatabaseHas('lunar_product_types', [
                'id' => $type->id,
                'name' => $newName,
            ]);
        }
    }

    public function test_blocked_roles_cannot_update_product_type(): void
    {
        $type = ProductType::query()->create(['name' => 'Initial Type Protected Name']);

        foreach (self::BLOCKED_ROLES as $role) {
            $this->actingAsRole($role);

            $response = $this->putJson("/api/admin/product-types/{$type->id}", [
                'name' => "Tampered By {$role}",
            ]);

            $response->assertForbidden(
                "Role '{$role}' must be forbidden from updating product type (PUT /api/admin/product-types/{$type->id})."
            );

            $this->assertDatabaseHas('lunar_product_types', [
                'id' => $type->id,
                'name' => 'Initial Type Protected Name',
            ]);
        }
    }

    public function test_allowed_roles_can_delete_product_type(): void
    {
        $counter = 1;
        foreach (self::ALLOWED_ROLES as $role) {
            $this->actingAsRole($role);

            $type = ProductType::query()->create(['name' => "Type To Delete By {$role} {$counter}"]);
            $counter++;

            $response = $this->deleteJson("/api/admin/product-types/{$type->id}");

            $response->assertNoContent();

            $this->assertDatabaseMissing('lunar_product_types', [
                'id' => $type->id,
            ]);
        }
    }

    public function test_blocked_roles_cannot_delete_product_type(): void
    {
        $type = ProductType::query()->create(['name' => 'Type Protected From Deletion']);

        foreach (self::BLOCKED_ROLES as $role) {
            $this->actingAsRole($role);

            $response = $this->deleteJson("/api/admin/product-types/{$type->id}");

            $response->assertForbidden(
                "Role '{$role}' must be forbidden from deleting product type (DELETE /api/admin/product-types/{$type->id})."
            );

            $this->assertDatabaseHas('lunar_product_types', [
                'id' => $type->id,
            ]);
        }
    }

    public function test_migration_seeds_and_assigns_product_type_permissions_to_existing_product_manager(): void
    {
        $migration = require database_path('migrations/2026_09_20_000003_seed_product_types_domain_permissions.php');
        $migration->up();

        $pm = Role::query()->where('name', 'Product Manager')->where('guard_name', 'web')->first();
        $this->assertNotNull($pm);

        foreach (AdminAbilityRegistry::PRODUCT_TYPES as $permission) {
            $this->assertTrue(
                $pm->hasPermissionTo($permission),
                "Product Manager must have permission '{$permission}' after migration."
            );
        }
    }

    public function test_unauthenticated_request_is_unauthorized_for_all_endpoints(): void
    {
        $type = ProductType::query()->create(['name' => 'Guest Type']);

        $this->getJson('/api/admin/product-types')->assertUnauthorized();
        $this->postJson('/api/admin/product-types', ['name' => 'Guest New'])->assertUnauthorized();
        $this->getJson("/api/admin/product-types/{$type->id}")->assertUnauthorized();
        $this->putJson("/api/admin/product-types/{$type->id}", ['name' => 'Guest Edit'])->assertUnauthorized();
        $this->deleteJson("/api/admin/product-types/{$type->id}")->assertUnauthorized();
    }

    private function actingAsRole(string $role): User
    {
        $user = User::factory()->create();
        $user->assignRole($role);
        Sanctum::actingAs($user);

        return $user;
    }
}
