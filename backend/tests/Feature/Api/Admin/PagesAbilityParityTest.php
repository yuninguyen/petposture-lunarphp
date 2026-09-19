<?php

declare(strict_types=1);

namespace Tests\Feature\Api\Admin;

use App\Models\Page;
use App\Models\User;
use App\Security\AdminAbilityRegistry;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

/**
 * Parity test suite for Phase 6b: Pages Domain Migration.
 *
 * Verifies exact 100% status code parity across all 7 roles and all page actions:
 * - Allowed (super_admin, admin, staff): 200, 204.
 * - Blocked (Product Manager, Order Manager, Support, customer): 403 Forbidden.
 */
class PagesAbilityParityTest extends TestCase
{
    use RefreshDatabase;

    private const ALLOWED_ROLES = [
        'super_admin',
        'admin',
        'staff',
    ];

    private const BLOCKED_ROLES = [
        'Product Manager',
        'Order Manager',
        'Support',
        'customer',
    ];

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
    }

    public function test_allowed_roles_can_list_pages(): void
    {
        Page::query()->create([
            'title' => 'About Us',
            'slug' => 'about-us',
            'content' => 'About content',
            'status' => 'published',
            'is_core' => false,
        ]);

        foreach (self::ALLOWED_ROLES as $role) {
            $this->actingAsRole($role);

            $response = $this->getJson('/api/admin/pages');

            $response->assertOk(
                "Role '{$role}' must be permitted to list pages (GET /api/admin/pages)."
            );
        }
    }

    public function test_blocked_roles_cannot_list_pages(): void
    {
        Page::query()->create([
            'title' => 'About Us Blocked',
            'slug' => 'about-us-blocked',
            'content' => 'About content',
            'status' => 'published',
            'is_core' => false,
        ]);

        foreach (self::BLOCKED_ROLES as $role) {
            $this->actingAsRole($role);

            $response = $this->getJson('/api/admin/pages');

            $response->assertForbidden(
                "Role '{$role}' must be forbidden from listing pages (GET /api/admin/pages)."
            );
        }
    }

    public function test_allowed_roles_can_show_page(): void
    {
        $page = Page::query()->create([
            'title' => 'Show Page',
            'slug' => 'show-page',
            'content' => 'Show content',
            'status' => 'published',
            'is_core' => false,
        ]);

        foreach (self::ALLOWED_ROLES as $role) {
            $this->actingAsRole($role);

            $response = $this->getJson("/api/admin/pages/{$page->id}");

            $response->assertOk(
                "Role '{$role}' must be permitted to show page (GET /api/admin/pages/{$page->id})."
            );
            $response->assertJsonPath('title', 'Show Page');
        }
    }

    public function test_blocked_roles_cannot_show_page(): void
    {
        $page = Page::query()->create([
            'title' => 'Show Page Blocked',
            'slug' => 'show-page-blocked',
            'content' => 'Show content',
            'status' => 'published',
            'is_core' => false,
        ]);

        foreach (self::BLOCKED_ROLES as $role) {
            $this->actingAsRole($role);

            $response = $this->getJson("/api/admin/pages/{$page->id}");

            $response->assertForbidden(
                "Role '{$role}' must be forbidden from showing page (GET /api/admin/pages/{$page->id})."
            );
        }
    }

    public function test_allowed_roles_can_create_page(): void
    {
        foreach (self::ALLOWED_ROLES as $role) {
            $this->actingAsRole($role);

            $slug = "page-created-by-{$role}";
            $title = "Page by {$role}";
            $response = $this->postJson('/api/admin/pages', [
                'title' => $title,
                'slug' => $slug,
                'content' => "Content for {$role}",
                'status' => 'published',
            ]);

            $response->assertOk(
                "Role '{$role}' must be permitted to create page (POST /api/admin/pages)."
            );
            $response->assertJsonPath('title', $title);

            $this->assertDatabaseHas('pages', [
                'slug' => $slug,
                'title' => $title,
            ]);
        }
    }

    public function test_blocked_roles_cannot_create_page(): void
    {
        foreach (self::BLOCKED_ROLES as $role) {
            $this->actingAsRole($role);

            $slug = "page-blocked-{$role}";
            $title = "Blocked Page {$role}";
            $response = $this->postJson('/api/admin/pages', [
                'title' => $title,
                'slug' => $slug,
                'content' => "Content for {$role}",
                'status' => 'published',
            ]);

            $response->assertForbidden(
                "Role '{$role}' must be forbidden from creating page (POST /api/admin/pages)."
            );

            $this->assertDatabaseMissing('pages', [
                'slug' => $slug,
            ]);
        }
    }

    public function test_allowed_roles_can_update_page(): void
    {
        $page = Page::query()->create([
            'title' => 'Original Title',
            'slug' => 'original-slug',
            'content' => 'Original content',
            'status' => 'draft',
            'is_core' => false,
        ]);

        foreach (self::ALLOWED_ROLES as $role) {
            $this->actingAsRole($role);

            $updatedTitle = "Updated by {$role}";
            $response = $this->putJson("/api/admin/pages/{$page->id}", [
                'title' => $updatedTitle,
                'slug' => 'original-slug',
                'content' => "Updated content by {$role}",
                'status' => 'published',
            ]);

            $response->assertOk(
                "Role '{$role}' must be permitted to update page (PUT /api/admin/pages/{$page->id})."
            );
            $this->assertDatabaseHas('pages', [
                'id' => $page->id,
                'title' => $updatedTitle,
                'status' => 'published',
            ]);
        }
    }

    public function test_blocked_roles_cannot_update_page(): void
    {
        $page = Page::query()->create([
            'title' => 'Protected Title',
            'slug' => 'protected-slug',
            'content' => 'Protected content',
            'status' => 'draft',
            'is_core' => false,
        ]);

        foreach (self::BLOCKED_ROLES as $role) {
            $this->actingAsRole($role);

            $response = $this->putJson("/api/admin/pages/{$page->id}", [
                'title' => "Hacked by {$role}",
                'slug' => 'protected-slug',
                'content' => 'Hacked content',
                'status' => 'published',
            ]);

            $response->assertForbidden(
                "Role '{$role}' must be forbidden from updating page (PUT /api/admin/pages/{$page->id})."
            );
            $this->assertDatabaseHas('pages', [
                'id' => $page->id,
                'title' => 'Protected Title',
                'status' => 'draft',
            ]);
        }
    }

    public function test_allowed_roles_can_delete_page(): void
    {
        foreach (self::ALLOWED_ROLES as $role) {
            $page = Page::query()->create([
                'title' => "Page to Delete {$role}",
                'slug' => "page-delete-{$role}",
                'content' => 'Delete content',
                'status' => 'draft',
                'is_core' => false,
            ]);

            $this->actingAsRole($role);

            $response = $this->deleteJson("/api/admin/pages/{$page->id}");

            $response->assertNoContent();
            $this->assertDatabaseMissing('pages', [
                'id' => $page->id,
            ]);
        }
    }

    public function test_blocked_roles_cannot_delete_page(): void
    {
        $page = Page::query()->create([
            'title' => 'Protected Page',
            'slug' => 'protected-page',
            'content' => 'Protected content',
            'status' => 'published',
            'is_core' => false,
        ]);

        foreach (self::BLOCKED_ROLES as $role) {
            $this->actingAsRole($role);

            $response = $this->deleteJson("/api/admin/pages/{$page->id}");

            $response->assertForbidden(
                "Role '{$role}' must be forbidden from deleting page (DELETE /api/admin/pages/{$page->id})."
            );
            $this->assertDatabaseHas('pages', [
                'id' => $page->id,
            ]);
        }
    }

    public function test_allowed_roles_can_bulk_delete_pages(): void
    {
        foreach (self::ALLOWED_ROLES as $role) {
            $p1 = Page::query()->create([
                'title' => "Bulk {$role} 1",
                'slug' => "bulk-{$role}-1",
                'content' => 'Bulk content 1',
                'status' => 'published',
                'is_core' => false,
            ]);
            $p2 = Page::query()->create([
                'title' => "Bulk {$role} 2",
                'slug' => "bulk-{$role}-2",
                'content' => 'Bulk content 2',
                'status' => 'published',
                'is_core' => false,
            ]);

            $this->actingAsRole($role);

            $response = $this->postJson('/api/admin/pages/bulk-delete', [
                'ids' => [$p1->id, $p2->id],
            ]);

            $response->assertNoContent();

            $this->assertDatabaseMissing('pages', ['id' => $p1->id]);
            $this->assertDatabaseMissing('pages', ['id' => $p2->id]);
        }
    }

    public function test_blocked_roles_cannot_bulk_delete_pages(): void
    {
        $p1 = Page::query()->create([
            'title' => 'Protected Bulk Page 1',
            'slug' => 'protected-bulk-p1',
            'content' => 'Protected content',
            'status' => 'published',
            'is_core' => false,
        ]);
        $p2 = Page::query()->create([
            'title' => 'Protected Bulk Page 2',
            'slug' => 'protected-bulk-p2',
            'content' => 'Protected content',
            'status' => 'published',
            'is_core' => false,
        ]);

        foreach (self::BLOCKED_ROLES as $role) {
            $this->actingAsRole($role);

            $response = $this->postJson('/api/admin/pages/bulk-delete', [
                'ids' => [$p1->id, $p2->id],
            ]);

            $response->assertForbidden(
                "Role '{$role}' must be forbidden from bulk deleting pages (POST /api/admin/pages/bulk-delete)."
            );

            $this->assertDatabaseHas('pages', ['id' => $p1->id]);
            $this->assertDatabaseHas('pages', ['id' => $p2->id]);
        }
    }

    public function test_migration_seeds_and_assigns_page_permissions_to_core_roles_only(): void
    {
        $migration = require database_path('migrations/2026_09_21_000003_seed_pages_domain_permissions.php');
        $migration->up();

        $admin = Role::query()->where('name', 'admin')->where('guard_name', 'web')->first();
        $this->assertNotNull($admin);

        foreach (AdminAbilityRegistry::PAGES as $permission) {
            $this->assertTrue(
                $admin->hasPermissionTo($permission),
                "Admin must have permission '{$permission}' after migration."
            );
        }

        foreach (['Product Manager', 'Order Manager', 'Support'] as $businessRole) {
            $role = Role::query()->where('name', $businessRole)->where('guard_name', 'web')->first();
            $this->assertNotNull($role);

            foreach (AdminAbilityRegistry::PAGES as $permission) {
                $this->assertFalse(
                    $role->hasPermissionTo($permission),
                    "Business role '{$businessRole}' must NOT have permission '{$permission}'."
                );
            }
        }
    }

    public function test_unauthenticated_request_is_unauthorized_for_all_endpoints(): void
    {
        $page = Page::query()->create([
            'title' => 'Guest Page',
            'slug' => 'guest-page',
            'content' => 'Guest content',
            'status' => 'draft',
            'is_core' => false,
        ]);

        $this->getJson('/api/admin/pages')->assertUnauthorized();
        $this->postJson('/api/admin/pages', [
            'title' => 'Guest New',
            'slug' => 'guest-new',
            'content' => 'Guest new',
            'status' => 'draft',
        ])->assertUnauthorized();
        $this->getJson("/api/admin/pages/{$page->id}")->assertUnauthorized();
        $this->putJson("/api/admin/pages/{$page->id}", [
            'title' => 'Guest Edit',
            'slug' => 'guest-page',
            'content' => 'Guest edit',
            'status' => 'published',
        ])->assertUnauthorized();
        $this->deleteJson("/api/admin/pages/{$page->id}")->assertUnauthorized();
        $this->postJson('/api/admin/pages/bulk-delete', ['ids' => [$page->id]])->assertUnauthorized();
    }

    private function actingAsRole(string $role): User
    {
        $user = User::factory()->create();
        $user->assignRole($role);
        Sanctum::actingAs($user);

        return $user;
    }
}
