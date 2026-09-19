<?php

declare(strict_types=1);

namespace Tests\Feature\Api\Admin;

use App\Models\Solution;
use App\Models\User;
use App\Security\AdminAbilityRegistry;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

/**
 * Parity test suite for Phase 6b: Solutions Domain Migration.
 *
 * Verifies exact 100% status code parity across all 7 roles and all 6 solution actions:
 * - Allowed (super_admin, admin, staff, Product Manager): 200, 201, 204.
 * - Blocked (Order Manager, Support, customer): 403 Forbidden.
 */
class SolutionsAbilityParityTest extends TestCase
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

    public function test_allowed_roles_can_list_solutions(): void
    {
        Solution::query()->create([
            'name' => 'Parity Solution Alpha',
            'slug' => 'parity-solution-alpha',
        ]);

        foreach (self::ALLOWED_ROLES as $role) {
            $this->actingAsRole($role);

            $response = $this->getJson('/api/admin/solutions');

            $response->assertOk(
                "Role '{$role}' must be permitted to list solutions (GET /api/admin/solutions)."
            );
        }
    }

    public function test_blocked_roles_cannot_list_solutions(): void
    {
        Solution::query()->create([
            'name' => 'Parity Solution Alpha',
            'slug' => 'parity-solution-alpha',
        ]);

        foreach (self::BLOCKED_ROLES as $role) {
            $this->actingAsRole($role);

            $response = $this->getJson('/api/admin/solutions');

            $response->assertForbidden(
                "Role '{$role}' must be forbidden from listing solutions (GET /api/admin/solutions)."
            );
        }
    }

    public function test_allowed_roles_can_show_solution(): void
    {
        $solution = Solution::query()->create([
            'name' => 'Parity Solution Show',
            'slug' => 'parity-solution-show',
        ]);

        foreach (self::ALLOWED_ROLES as $role) {
            $this->actingAsRole($role);

            $response = $this->getJson("/api/admin/solutions/{$solution->id}");

            $response->assertOk(
                "Role '{$role}' must be permitted to show solution (GET /api/admin/solutions/{$solution->id})."
            );
            $response->assertJsonPath('data.name', 'Parity Solution Show');
        }
    }

    public function test_blocked_roles_cannot_show_solution(): void
    {
        $solution = Solution::query()->create([
            'name' => 'Parity Solution Show',
            'slug' => 'parity-solution-show',
        ]);

        foreach (self::BLOCKED_ROLES as $role) {
            $this->actingAsRole($role);

            $response = $this->getJson("/api/admin/solutions/{$solution->id}");

            $response->assertForbidden(
                "Role '{$role}' must be forbidden from showing solution (GET /api/admin/solutions/{$solution->id})."
            );
        }
    }

    public function test_allowed_roles_can_create_solution(): void
    {
        $counter = 1;
        foreach (self::ALLOWED_ROLES as $role) {
            $this->actingAsRole($role);

            $solutionName = "Solution Created By {$role} {$counter}";
            $solutionSlug = "solution-created-by-" . strtolower(str_replace(' ', '-', $role)) . "-{$counter}";
            $counter++;

            $response = $this->postJson('/api/admin/solutions', [
                'name' => $solutionName,
                'slug' => $solutionSlug,
            ]);

            $response->assertCreated(
                "Role '{$role}' must be permitted to create solution (POST /api/admin/solutions)."
            );
            $response->assertJsonPath('data.name', $solutionName);

            $this->assertDatabaseHas('solutions', [
                'name' => $solutionName,
                'slug' => $solutionSlug,
            ]);
        }
    }

    public function test_blocked_roles_cannot_create_solution(): void
    {
        $counter = 1;
        foreach (self::BLOCKED_ROLES as $role) {
            $this->actingAsRole($role);

            $solutionName = "Unauthorized Solution {$role} {$counter}";
            $solutionSlug = "unauthorized-solution-" . strtolower(str_replace(' ', '-', $role)) . "-{$counter}";
            $counter++;

            $response = $this->postJson('/api/admin/solutions', [
                'name' => $solutionName,
                'slug' => $solutionSlug,
            ]);

            $response->assertForbidden(
                "Role '{$role}' must be forbidden from creating solution (POST /api/admin/solutions)."
            );

            $this->assertDatabaseMissing('solutions', [
                'name' => $solutionName,
            ]);
        }
    }

    public function test_allowed_roles_can_update_solution(): void
    {
        $solution = Solution::query()->create([
            'name' => 'Initial Solution Update Name',
            'slug' => 'initial-solution-update-name',
        ]);
        $counter = 1;

        foreach (self::ALLOWED_ROLES as $role) {
            $this->actingAsRole($role);

            $newName = "Solution Updated By {$role} {$counter}";
            $newSlug = "solution-updated-by-" . strtolower(str_replace(' ', '-', $role)) . "-{$counter}";
            $counter++;

            $response = $this->putJson("/api/admin/solutions/{$solution->id}", [
                'name' => $newName,
                'slug' => $newSlug,
            ]);

            $response->assertOk(
                "Role '{$role}' must be permitted to update solution (PUT /api/admin/solutions/{$solution->id})."
            );
            $response->assertJsonPath('data.name', $newName);

            $this->assertDatabaseHas('solutions', [
                'id' => $solution->id,
                'name' => $newName,
                'slug' => $newSlug,
            ]);
        }
    }

    public function test_blocked_roles_cannot_update_solution(): void
    {
        $solution = Solution::query()->create([
            'name' => 'Initial Solution Protected Name',
            'slug' => 'initial-solution-protected-name',
        ]);

        foreach (self::BLOCKED_ROLES as $role) {
            $this->actingAsRole($role);

            $response = $this->putJson("/api/admin/solutions/{$solution->id}", [
                'name' => "Tampered By {$role}",
                'slug' => "tampered-by-" . strtolower(str_replace(' ', '-', $role)),
            ]);

            $response->assertForbidden(
                "Role '{$role}' must be forbidden from updating solution (PUT /api/admin/solutions/{$solution->id})."
            );

            $this->assertDatabaseHas('solutions', [
                'id' => $solution->id,
                'name' => 'Initial Solution Protected Name',
            ]);
        }
    }

    public function test_allowed_roles_can_delete_single_solution(): void
    {
        $counter = 1;
        foreach (self::ALLOWED_ROLES as $role) {
            $this->actingAsRole($role);

            $solution = Solution::query()->create([
                'name' => "Solution To Delete By {$role} {$counter}",
                'slug' => "solution-to-delete-by-" . strtolower(str_replace(' ', '-', $role)) . "-{$counter}",
            ]);
            $counter++;

            $response = $this->deleteJson("/api/admin/solutions/{$solution->id}");

            $response->assertNoContent();

            $this->assertDatabaseMissing('solutions', [
                'id' => $solution->id,
            ]);
        }
    }

    public function test_blocked_roles_cannot_delete_single_solution(): void
    {
        $solution = Solution::query()->create([
            'name' => 'Solution Protected From Single Deletion',
            'slug' => 'solution-protected-from-single-deletion',
        ]);

        foreach (self::BLOCKED_ROLES as $role) {
            $this->actingAsRole($role);

            $response = $this->deleteJson("/api/admin/solutions/{$solution->id}");

            $response->assertForbidden(
                "Role '{$role}' must be forbidden from deleting solution (DELETE /api/admin/solutions/{$solution->id})."
            );

            $this->assertDatabaseHas('solutions', [
                'id' => $solution->id,
            ]);
        }
    }

    public function test_allowed_roles_can_bulk_delete_solutions(): void
    {
        $counter = 1;
        foreach (self::ALLOWED_ROLES as $role) {
            $this->actingAsRole($role);

            $s1 = Solution::query()->create([
                'name' => "Bulk Delete Item 1 By {$role} {$counter}",
                'slug' => "bulk-delete-item-1-" . strtolower(str_replace(' ', '-', $role)) . "-{$counter}",
            ]);
            $s2 = Solution::query()->create([
                'name' => "Bulk Delete Item 2 By {$role} {$counter}",
                'slug' => "bulk-delete-item-2-" . strtolower(str_replace(' ', '-', $role)) . "-{$counter}",
            ]);
            $counter++;

            $response = $this->postJson('/api/admin/solutions/bulk-delete', [
                'ids' => [$s1->id, $s2->id],
            ]);

            $response->assertNoContent();

            $this->assertDatabaseMissing('solutions', [
                'id' => $s1->id,
            ]);
            $this->assertDatabaseMissing('solutions', [
                'id' => $s2->id,
            ]);
        }
    }

    public function test_blocked_roles_cannot_bulk_delete_solutions(): void
    {
        $s1 = Solution::query()->create([
            'name' => 'Bulk Protected Solution 1',
            'slug' => 'bulk-protected-solution-1',
        ]);
        $s2 = Solution::query()->create([
            'name' => 'Bulk Protected Solution 2',
            'slug' => 'bulk-protected-solution-2',
        ]);

        foreach (self::BLOCKED_ROLES as $role) {
            $this->actingAsRole($role);

            $response = $this->postJson('/api/admin/solutions/bulk-delete', [
                'ids' => [$s1->id, $s2->id],
            ]);

            $response->assertForbidden(
                "Role '{$role}' must be forbidden from bulk deleting solutions (POST /api/admin/solutions/bulk-delete)."
            );

            $this->assertDatabaseHas('solutions', [
                'id' => $s1->id,
            ]);
            $this->assertDatabaseHas('solutions', [
                'id' => $s2->id,
            ]);
        }
    }

    public function test_migration_seeds_and_assigns_solution_permissions_to_existing_product_manager(): void
    {
        $migration = require database_path('migrations/2026_09_20_000005_seed_solutions_domain_permissions.php');
        $migration->up();

        $pm = Role::query()->where('name', 'Product Manager')->where('guard_name', 'web')->first();
        $this->assertNotNull($pm);

        foreach (AdminAbilityRegistry::SOLUTIONS as $permission) {
            $this->assertTrue(
                $pm->hasPermissionTo($permission),
                "Product Manager must have permission '{$permission}' after migration."
            );
        }
    }

    public function test_unauthenticated_request_is_unauthorized_for_all_endpoints(): void
    {
        $solution = Solution::query()->create([
            'name' => 'Guest Solution',
            'slug' => 'guest-solution',
        ]);

        $this->getJson('/api/admin/solutions')->assertUnauthorized();
        $this->postJson('/api/admin/solutions', [
            'name' => 'Guest New',
            'slug' => 'guest-new',
        ])->assertUnauthorized();
        $this->getJson("/api/admin/solutions/{$solution->id}")->assertUnauthorized();
        $this->putJson("/api/admin/solutions/{$solution->id}", [
            'name' => 'Guest Edit',
            'slug' => 'guest-edit',
        ])->assertUnauthorized();
        $this->deleteJson("/api/admin/solutions/{$solution->id}")->assertUnauthorized();
        $this->postJson('/api/admin/solutions/bulk-delete', [
            'ids' => [$solution->id],
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
