<?php

declare(strict_types=1);

namespace Tests\Feature\Api\Admin;

use App\Models\Breed;
use App\Models\User;
use App\Security\AdminAbilityRegistry;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

/**
 * Parity test suite for Phase 6b: Breeds Domain Migration.
 *
 * Verifies exact 100% status code parity across all 7 roles and all 6 breed actions:
 * - Allowed (super_admin, admin, staff, Product Manager): 200, 201, 204.
 * - Blocked (Order Manager, Support, customer): 403 Forbidden.
 */
class BreedsAbilityParityTest extends TestCase
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

    public function test_allowed_roles_can_list_breeds(): void
    {
        Breed::query()->create([
            'name' => 'Parity Breed Alpha',
            'slug' => 'parity-breed-alpha',
        ]);

        foreach (self::ALLOWED_ROLES as $role) {
            $this->actingAsRole($role);

            $response = $this->getJson('/api/admin/breeds');

            $response->assertOk(
                "Role '{$role}' must be permitted to list breeds (GET /api/admin/breeds)."
            );
        }
    }

    public function test_blocked_roles_cannot_list_breeds(): void
    {
        Breed::query()->create([
            'name' => 'Parity Breed Alpha',
            'slug' => 'parity-breed-alpha',
        ]);

        foreach (self::BLOCKED_ROLES as $role) {
            $this->actingAsRole($role);

            $response = $this->getJson('/api/admin/breeds');

            $response->assertForbidden(
                "Role '{$role}' must be forbidden from listing breeds (GET /api/admin/breeds)."
            );
        }
    }

    public function test_allowed_roles_can_show_breed(): void
    {
        $breed = Breed::query()->create([
            'name' => 'Parity Breed Show',
            'slug' => 'parity-breed-show',
        ]);

        foreach (self::ALLOWED_ROLES as $role) {
            $this->actingAsRole($role);

            $response = $this->getJson("/api/admin/breeds/{$breed->id}");

            $response->assertOk(
                "Role '{$role}' must be permitted to show breed (GET /api/admin/breeds/{$breed->id})."
            );
            $response->assertJsonPath('data.name', 'Parity Breed Show');
        }
    }

    public function test_blocked_roles_cannot_show_breed(): void
    {
        $breed = Breed::query()->create([
            'name' => 'Parity Breed Show',
            'slug' => 'parity-breed-show',
        ]);

        foreach (self::BLOCKED_ROLES as $role) {
            $this->actingAsRole($role);

            $response = $this->getJson("/api/admin/breeds/{$breed->id}");

            $response->assertForbidden(
                "Role '{$role}' must be forbidden from showing breed (GET /api/admin/breeds/{$breed->id})."
            );
        }
    }

    public function test_allowed_roles_can_create_breed(): void
    {
        $counter = 1;
        foreach (self::ALLOWED_ROLES as $role) {
            $this->actingAsRole($role);

            $breedName = "Breed Created By {$role} {$counter}";
            $breedSlug = "breed-created-by-" . strtolower(str_replace(' ', '-', $role)) . "-{$counter}";
            $counter++;

            $response = $this->postJson('/api/admin/breeds', [
                'name' => $breedName,
                'slug' => $breedSlug,
            ]);

            $response->assertCreated(
                "Role '{$role}' must be permitted to create breed (POST /api/admin/breeds)."
            );
            $response->assertJsonPath('data.name', $breedName);

            $this->assertDatabaseHas('breeds', [
                'name' => $breedName,
                'slug' => $breedSlug,
            ]);
        }
    }

    public function test_blocked_roles_cannot_create_breed(): void
    {
        $counter = 1;
        foreach (self::BLOCKED_ROLES as $role) {
            $this->actingAsRole($role);

            $breedName = "Unauthorized Breed {$role} {$counter}";
            $breedSlug = "unauthorized-breed-" . strtolower(str_replace(' ', '-', $role)) . "-{$counter}";
            $counter++;

            $response = $this->postJson('/api/admin/breeds', [
                'name' => $breedName,
                'slug' => $breedSlug,
            ]);

            $response->assertForbidden(
                "Role '{$role}' must be forbidden from creating breed (POST /api/admin/breeds)."
            );

            $this->assertDatabaseMissing('breeds', [
                'name' => $breedName,
            ]);
        }
    }

    public function test_allowed_roles_can_update_breed(): void
    {
        $breed = Breed::query()->create([
            'name' => 'Initial Breed Update Name',
            'slug' => 'initial-breed-update-name',
        ]);
        $counter = 1;

        foreach (self::ALLOWED_ROLES as $role) {
            $this->actingAsRole($role);

            $newName = "Breed Updated By {$role} {$counter}";
            $newSlug = "breed-updated-by-" . strtolower(str_replace(' ', '-', $role)) . "-{$counter}";
            $counter++;

            $response = $this->putJson("/api/admin/breeds/{$breed->id}", [
                'name' => $newName,
                'slug' => $newSlug,
            ]);

            $response->assertOk(
                "Role '{$role}' must be permitted to update breed (PUT /api/admin/breeds/{$breed->id})."
            );
            $response->assertJsonPath('data.name', $newName);

            $this->assertDatabaseHas('breeds', [
                'id' => $breed->id,
                'name' => $newName,
                'slug' => $newSlug,
            ]);
        }
    }

    public function test_blocked_roles_cannot_update_breed(): void
    {
        $breed = Breed::query()->create([
            'name' => 'Initial Breed Protected Name',
            'slug' => 'initial-breed-protected-name',
        ]);

        foreach (self::BLOCKED_ROLES as $role) {
            $this->actingAsRole($role);

            $response = $this->putJson("/api/admin/breeds/{$breed->id}", [
                'name' => "Tampered By {$role}",
                'slug' => "tampered-by-" . strtolower(str_replace(' ', '-', $role)),
            ]);

            $response->assertForbidden(
                "Role '{$role}' must be forbidden from updating breed (PUT /api/admin/breeds/{$breed->id})."
            );

            $this->assertDatabaseHas('breeds', [
                'id' => $breed->id,
                'name' => 'Initial Breed Protected Name',
            ]);
        }
    }

    public function test_allowed_roles_can_delete_single_breed(): void
    {
        $counter = 1;
        foreach (self::ALLOWED_ROLES as $role) {
            $this->actingAsRole($role);

            $breed = Breed::query()->create([
                'name' => "Breed To Delete By {$role} {$counter}",
                'slug' => "breed-to-delete-by-" . strtolower(str_replace(' ', '-', $role)) . "-{$counter}",
            ]);
            $counter++;

            $response = $this->deleteJson("/api/admin/breeds/{$breed->id}");

            $response->assertNoContent();

            $this->assertDatabaseMissing('breeds', [
                'id' => $breed->id,
            ]);
        }
    }

    public function test_blocked_roles_cannot_delete_single_breed(): void
    {
        $breed = Breed::query()->create([
            'name' => 'Breed Protected From Single Deletion',
            'slug' => 'breed-protected-from-single-deletion',
        ]);

        foreach (self::BLOCKED_ROLES as $role) {
            $this->actingAsRole($role);

            $response = $this->deleteJson("/api/admin/breeds/{$breed->id}");

            $response->assertForbidden(
                "Role '{$role}' must be forbidden from deleting breed (DELETE /api/admin/breeds/{$breed->id})."
            );

            $this->assertDatabaseHas('breeds', [
                'id' => $breed->id,
            ]);
        }
    }

    public function test_allowed_roles_can_bulk_delete_breeds(): void
    {
        $counter = 1;
        foreach (self::ALLOWED_ROLES as $role) {
            $this->actingAsRole($role);

            $breed1 = Breed::query()->create([
                'name' => "Bulk Delete Item 1 By {$role} {$counter}",
                'slug' => "bulk-delete-item-1-" . strtolower(str_replace(' ', '-', $role)) . "-{$counter}",
            ]);
            $breed2 = Breed::query()->create([
                'name' => "Bulk Delete Item 2 By {$role} {$counter}",
                'slug' => "bulk-delete-item-2-" . strtolower(str_replace(' ', '-', $role)) . "-{$counter}",
            ]);
            $counter++;

            $response = $this->postJson('/api/admin/breeds/bulk-delete', [
                'ids' => [$breed1->id, $breed2->id],
            ]);

            $response->assertNoContent();

            $this->assertDatabaseMissing('breeds', [
                'id' => $breed1->id,
            ]);
            $this->assertDatabaseMissing('breeds', [
                'id' => $breed2->id,
            ]);
        }
    }

    public function test_blocked_roles_cannot_bulk_delete_breeds(): void
    {
        $breed1 = Breed::query()->create([
            'name' => 'Bulk Protected Breed 1',
            'slug' => 'bulk-protected-breed-1',
        ]);
        $breed2 = Breed::query()->create([
            'name' => 'Bulk Protected Breed 2',
            'slug' => 'bulk-protected-breed-2',
        ]);

        foreach (self::BLOCKED_ROLES as $role) {
            $this->actingAsRole($role);

            $response = $this->postJson('/api/admin/breeds/bulk-delete', [
                'ids' => [$breed1->id, $breed2->id],
            ]);

            $response->assertForbidden(
                "Role '{$role}' must be forbidden from bulk deleting breeds (POST /api/admin/breeds/bulk-delete)."
            );

            $this->assertDatabaseHas('breeds', [
                'id' => $breed1->id,
            ]);
            $this->assertDatabaseHas('breeds', [
                'id' => $breed2->id,
            ]);
        }
    }

    public function test_migration_seeds_and_assigns_breed_permissions_to_existing_product_manager(): void
    {
        $migration = require database_path('migrations/2026_09_19_000001_seed_breeds_domain_permissions.php');
        $migration->up();

        $pm = Role::query()->where('name', 'Product Manager')->where('guard_name', 'web')->first();
        $this->assertNotNull($pm);

        foreach (AdminAbilityRegistry::BREEDS as $permission) {
            $this->assertTrue(
                $pm->hasPermissionTo($permission),
                "Product Manager must have permission '{$permission}' after migration."
            );
        }
    }

    public function test_unauthenticated_request_is_unauthorized_for_all_endpoints(): void
    {
        $breed = Breed::query()->create([
            'name' => 'Guest Breed',
            'slug' => 'guest-breed',
        ]);

        $this->getJson('/api/admin/breeds')->assertUnauthorized();
        $this->postJson('/api/admin/breeds', [
            'name' => 'Guest New',
            'slug' => 'guest-new',
        ])->assertUnauthorized();
        $this->getJson("/api/admin/breeds/{$breed->id}")->assertUnauthorized();
        $this->putJson("/api/admin/breeds/{$breed->id}", [
            'name' => 'Guest Edit',
            'slug' => 'guest-edit',
        ])->assertUnauthorized();
        $this->deleteJson("/api/admin/breeds/{$breed->id}")->assertUnauthorized();
        $this->postJson('/api/admin/breeds/bulk-delete', [
            'ids' => [$breed->id],
        ])->assertUnauthorized();
    }

    private function actingAsRole(string $role): User
    {
        $user = User::factory()->create();
        $user->assignRole($role);
        Sanctum::actingAs($user);

        return $user;
    }
}
