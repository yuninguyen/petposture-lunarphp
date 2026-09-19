<?php

declare(strict_types=1);

namespace Tests\Feature\Api\Admin;

use App\Models\BlogTag;
use App\Models\User;
use App\Security\AdminAbilityRegistry;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

/**
 * Parity test suite for Phase 6b: Blog Tags Domain Migration.
 *
 * Verifies exact 100% status code parity across all 7 roles and all blog tag actions:
 * - Allowed (super_admin, admin, staff): 200, 201, 204.
 * - Blocked (Product Manager, Order Manager, Support, customer): 403 Forbidden.
 */
class BlogTagsAbilityParityTest extends TestCase
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

    public function test_allowed_roles_can_list_blog_tags(): void
    {
        BlogTag::query()->create([
            'name' => 'Tag Alpha',
            'slug' => 'tag-alpha',
        ]);

        foreach (self::ALLOWED_ROLES as $role) {
            $this->actingAsRole($role);

            $response = $this->getJson('/api/admin/blog/tags');

            $response->assertOk(
                "Role '{$role}' must be permitted to list blog tags (GET /api/admin/blog/tags)."
            );
        }
    }

    public function test_blocked_roles_cannot_list_blog_tags(): void
    {
        BlogTag::query()->create([
            'name' => 'Tag Alpha',
            'slug' => 'tag-alpha',
        ]);

        foreach (self::BLOCKED_ROLES as $role) {
            $this->actingAsRole($role);

            $response = $this->getJson('/api/admin/blog/tags');

            $response->assertForbidden(
                "Role '{$role}' must be forbidden from listing blog tags (GET /api/admin/blog/tags)."
            );
        }
    }

    public function test_allowed_roles_can_show_blog_tag(): void
    {
        $tag = BlogTag::query()->create([
            'name' => 'Show Tag',
            'slug' => 'show-tag',
        ]);

        foreach (self::ALLOWED_ROLES as $role) {
            $this->actingAsRole($role);

            $response = $this->getJson("/api/admin/blog/tags/{$tag->id}");

            $response->assertOk(
                "Role '{$role}' must be permitted to show blog tag (GET /api/admin/blog/tags/{$tag->id})."
            );
            $response->assertJsonPath('data.name', 'Show Tag');
        }
    }

    public function test_blocked_roles_cannot_show_blog_tag(): void
    {
        $tag = BlogTag::query()->create([
            'name' => 'Show Tag Blocked',
            'slug' => 'show-tag-blocked',
        ]);

        foreach (self::BLOCKED_ROLES as $role) {
            $this->actingAsRole($role);

            $response = $this->getJson("/api/admin/blog/tags/{$tag->id}");

            $response->assertForbidden(
                "Role '{$role}' must be forbidden from showing blog tag (GET /api/admin/blog/tags/{$tag->id})."
            );
        }
    }

    public function test_allowed_roles_can_create_blog_tag(): void
    {
        foreach (self::ALLOWED_ROLES as $role) {
            $this->actingAsRole($role);

            $name = "Tag by {$role}";
            $response = $this->postJson('/api/admin/blog/tags', [
                'name' => $name,
            ]);

            $response->assertCreated(
                "Role '{$role}' must be permitted to create blog tag (POST /api/admin/blog/tags)."
            );
            $response->assertJsonPath('name', $name);

            $this->assertDatabaseHas('blog_tags', [
                'name' => $name,
            ]);
        }
    }

    public function test_blocked_roles_cannot_create_blog_tag(): void
    {
        foreach (self::BLOCKED_ROLES as $role) {
            $this->actingAsRole($role);

            $name = "Blocked Tag {$role}";
            $response = $this->postJson('/api/admin/blog/tags', [
                'name' => $name,
            ]);

            $response->assertForbidden(
                "Role '{$role}' must be forbidden from creating blog tag (POST /api/admin/blog/tags)."
            );

            $this->assertDatabaseMissing('blog_tags', [
                'name' => $name,
            ]);
        }
    }

    public function test_allowed_roles_can_update_blog_tag(): void
    {
        $tag = BlogTag::query()->create([
            'name' => 'Original Tag',
            'slug' => 'original-tag',
        ]);

        foreach (self::ALLOWED_ROLES as $role) {
            $this->actingAsRole($role);

            $updatedName = "Updated by {$role}";
            $response = $this->putJson("/api/admin/blog/tags/{$tag->id}", [
                'name' => $updatedName,
            ]);

            $response->assertOk(
                "Role '{$role}' must be permitted to update blog tag (PUT /api/admin/blog/tags/{$tag->id})."
            );
            $this->assertDatabaseHas('blog_tags', [
                'id' => $tag->id,
                'name' => $updatedName,
            ]);
        }
    }

    public function test_blocked_roles_cannot_update_blog_tag(): void
    {
        $tag = BlogTag::query()->create([
            'name' => 'Original Tag Blocked',
            'slug' => 'original-tag-blocked',
        ]);

        foreach (self::BLOCKED_ROLES as $role) {
            $this->actingAsRole($role);

            $response = $this->putJson("/api/admin/blog/tags/{$tag->id}", [
                'name' => "Hacked by {$role}",
            ]);

            $response->assertForbidden(
                "Role '{$role}' must be forbidden from updating blog tag (PUT /api/admin/blog/tags/{$tag->id})."
            );
            $this->assertDatabaseHas('blog_tags', [
                'id' => $tag->id,
                'name' => 'Original Tag Blocked',
            ]);
        }
    }

    public function test_allowed_roles_can_delete_blog_tag(): void
    {
        foreach (self::ALLOWED_ROLES as $role) {
            $tag = BlogTag::query()->create([
                'name' => "Tag to Delete {$role}",
                'slug' => "tag-delete-{$role}",
            ]);

            $this->actingAsRole($role);

            $response = $this->deleteJson("/api/admin/blog/tags/{$tag->id}");

            $response->assertNoContent();
            $this->assertDatabaseMissing('blog_tags', [
                'id' => $tag->id,
            ]);
        }
    }

    public function test_blocked_roles_cannot_delete_blog_tag(): void
    {
        $tag = BlogTag::query()->create([
            'name' => 'Protected Tag',
            'slug' => 'protected-tag',
        ]);

        foreach (self::BLOCKED_ROLES as $role) {
            $this->actingAsRole($role);

            $response = $this->deleteJson("/api/admin/blog/tags/{$tag->id}");

            $response->assertForbidden(
                "Role '{$role}' must be forbidden from deleting blog tag (DELETE /api/admin/blog/tags/{$tag->id})."
            );
            $this->assertDatabaseHas('blog_tags', [
                'id' => $tag->id,
            ]);
        }
    }

    public function test_allowed_roles_can_bulk_delete_blog_tags(): void
    {
        foreach (self::ALLOWED_ROLES as $role) {
            $t1 = BlogTag::query()->create(['name' => "Bulk {$role} 1", 'slug' => "bulk-{$role}-1"]);
            $t2 = BlogTag::query()->create(['name' => "Bulk {$role} 2", 'slug' => "bulk-{$role}-2"]);

            $this->actingAsRole($role);

            $response = $this->postJson('/api/admin/blog/tags/bulk-delete', [
                'ids' => [$t1->id, $t2->id],
            ]);

            $response->assertNoContent();

            $this->assertDatabaseMissing('blog_tags', ['id' => $t1->id]);
            $this->assertDatabaseMissing('blog_tags', ['id' => $t2->id]);
        }
    }

    public function test_blocked_roles_cannot_bulk_delete_blog_tags(): void
    {
        $t1 = BlogTag::query()->create(['name' => 'Protected Bulk Tag 1', 'slug' => 'protected-bulk-1']);
        $t2 = BlogTag::query()->create(['name' => 'Protected Bulk Tag 2', 'slug' => 'protected-bulk-2']);

        foreach (self::BLOCKED_ROLES as $role) {
            $this->actingAsRole($role);

            $response = $this->postJson('/api/admin/blog/tags/bulk-delete', [
                'ids' => [$t1->id, $t2->id],
            ]);

            $response->assertForbidden(
                "Role '{$role}' must be forbidden from bulk deleting blog tags (POST /api/admin/blog/tags/bulk-delete)."
            );

            $this->assertDatabaseHas('blog_tags', ['id' => $t1->id]);
            $this->assertDatabaseHas('blog_tags', ['id' => $t2->id]);
        }
    }

    public function test_migration_seeds_and_assigns_blog_tag_permissions_to_core_roles_only(): void
    {
        $migration = require database_path('migrations/2026_09_21_000002_seed_blog_tags_domain_permissions.php');
        $migration->up();

        $admin = Role::query()->where('name', 'admin')->where('guard_name', 'web')->first();
        $this->assertNotNull($admin);

        foreach (AdminAbilityRegistry::BLOG_TAGS as $permission) {
            $this->assertTrue(
                $admin->hasPermissionTo($permission),
                "Admin must have permission '{$permission}' after migration."
            );
        }

        foreach (['Product Manager', 'Order Manager', 'Support'] as $businessRole) {
            $role = Role::query()->where('name', $businessRole)->where('guard_name', 'web')->first();
            $this->assertNotNull($role);

            foreach (AdminAbilityRegistry::BLOG_TAGS as $permission) {
                $this->assertFalse(
                    $role->hasPermissionTo($permission),
                    "Business role '{$businessRole}' must NOT have permission '{$permission}'."
                );
            }
        }
    }

    public function test_unauthenticated_request_is_unauthorized_for_all_endpoints(): void
    {
        $tag = BlogTag::query()->create([
            'name' => 'Guest Tag',
            'slug' => 'guest-tag',
        ]);

        $this->getJson('/api/admin/blog/tags')->assertUnauthorized();
        $this->postJson('/api/admin/blog/tags', ['name' => 'Guest New'])->assertUnauthorized();
        $this->getJson("/api/admin/blog/tags/{$tag->id}")->assertUnauthorized();
        $this->putJson("/api/admin/blog/tags/{$tag->id}", ['name' => 'Guest Edit'])->assertUnauthorized();
        $this->deleteJson("/api/admin/blog/tags/{$tag->id}")->assertUnauthorized();
        $this->postJson('/api/admin/blog/tags/bulk-delete', ['ids' => [$tag->id]])->assertUnauthorized();
    }

    private function actingAsRole(string $role): User
    {
        $user = User::factory()->create();
        $user->assignRole($role);
        Sanctum::actingAs($user);

        return $user;
    }
}
