<?php

declare(strict_types=1);

namespace Tests\Feature\Api\Admin;

use App\Models\Comment;
use App\Models\Post;
use App\Models\User;
use App\Security\AdminAbilityRegistry;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

/**
 * Parity test suite for Phase 6b: Comments Domain Migration.
 *
 * Verifies exact 100% status code parity across all 7 roles and all comment actions:
 * - Allowed (super_admin, admin, staff): 200, 201, 204.
 * - Blocked (Product Manager, Order Manager, Support, customer): 403 Forbidden.
 */
class CommentsAbilityParityTest extends TestCase
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

    public function test_allowed_roles_can_list_comments(): void
    {
        $post = $this->createPost('Post for List');
        Comment::query()->create([
            'post_id' => $post->id,
            'customer_name' => 'Commenter Alpha',
            'comment' => 'Great post!',
            'status' => 'approved',
        ]);

        foreach (self::ALLOWED_ROLES as $role) {
            $this->actingAsRole($role);

            $response = $this->getJson('/api/admin/comments');

            $response->assertOk(
                "Role '{$role}' must be permitted to list comments (GET /api/admin/comments)."
            );
        }
    }

    public function test_blocked_roles_cannot_list_comments(): void
    {
        $post = $this->createPost('Post for List Blocked');
        Comment::query()->create([
            'post_id' => $post->id,
            'customer_name' => 'Commenter Alpha',
            'comment' => 'Great post!',
            'status' => 'approved',
        ]);

        foreach (self::BLOCKED_ROLES as $role) {
            $this->actingAsRole($role);

            $response = $this->getJson('/api/admin/comments');

            $response->assertForbidden(
                "Role '{$role}' must be forbidden from listing comments (GET /api/admin/comments)."
            );
        }
    }

    public function test_allowed_roles_can_show_comment(): void
    {
        $post = $this->createPost('Post for Show');
        $comment = Comment::query()->create([
            'post_id' => $post->id,
            'customer_name' => 'Show Commenter',
            'comment' => 'Show comment body',
            'status' => 'approved',
        ]);

        foreach (self::ALLOWED_ROLES as $role) {
            $this->actingAsRole($role);

            $response = $this->getJson("/api/admin/comments/{$comment->id}");

            $response->assertOk(
                "Role '{$role}' must be permitted to show comment (GET /api/admin/comments/{$comment->id})."
            );
            $response->assertJsonPath('data.customer_name', 'Show Commenter');
        }
    }

    public function test_blocked_roles_cannot_show_comment(): void
    {
        $post = $this->createPost('Post for Show Blocked');
        $comment = Comment::query()->create([
            'post_id' => $post->id,
            'customer_name' => 'Show Commenter',
            'comment' => 'Show comment body',
            'status' => 'approved',
        ]);

        foreach (self::BLOCKED_ROLES as $role) {
            $this->actingAsRole($role);

            $response = $this->getJson("/api/admin/comments/{$comment->id}");

            $response->assertForbidden(
                "Role '{$role}' must be forbidden from showing comment (GET /api/admin/comments/{$comment->id})."
            );
        }
    }

    public function test_allowed_roles_can_create_comment(): void
    {
        $post = $this->createPost('Post for Create');

        foreach (self::ALLOWED_ROLES as $role) {
            $this->actingAsRole($role);

            $name = "Author {$role}";
            $response = $this->postJson('/api/admin/comments', [
                'post_id' => $post->id,
                'customer_name' => $name,
                'status' => 'pending',
                'comment' => "Comment by {$role}",
            ]);

            $response->assertCreated(
                "Role '{$role}' must be permitted to create comment (POST /api/admin/comments)."
            );
            $response->assertJsonPath('data.customer_name', $name);

            $this->assertDatabaseHas('comments', [
                'customer_name' => $name,
                'post_id' => $post->id,
            ]);
        }
    }

    public function test_blocked_roles_cannot_create_comment(): void
    {
        $post = $this->createPost('Post for Create Blocked');

        foreach (self::BLOCKED_ROLES as $role) {
            $this->actingAsRole($role);

            $name = "Blocked Author {$role}";
            $response = $this->postJson('/api/admin/comments', [
                'post_id' => $post->id,
                'customer_name' => $name,
                'status' => 'pending',
                'comment' => "Blocked comment by {$role}",
            ]);

            $response->assertForbidden(
                "Role '{$role}' must be forbidden from creating comment (POST /api/admin/comments)."
            );

            $this->assertDatabaseMissing('comments', [
                'customer_name' => $name,
            ]);
        }
    }

    public function test_allowed_roles_can_update_comment(): void
    {
        $post = $this->createPost('Post for Update');
        $comment = Comment::query()->create([
            'post_id' => $post->id,
            'customer_name' => 'Original Commenter',
            'comment' => 'Original comment',
            'status' => 'pending',
        ]);

        foreach (self::ALLOWED_ROLES as $role) {
            $this->actingAsRole($role);

            $updatedText = "Updated comment by {$role}";
            $response = $this->putJson("/api/admin/comments/{$comment->id}", [
                'post_id' => $post->id,
                'customer_name' => 'Original Commenter',
                'comment' => $updatedText,
                'status' => 'approved',
            ]);

            $response->assertOk(
                "Role '{$role}' must be permitted to update comment (PUT /api/admin/comments/{$comment->id})."
            );
            $this->assertDatabaseHas('comments', [
                'id' => $comment->id,
                'comment' => $updatedText,
                'status' => 'approved',
            ]);
        }
    }

    public function test_blocked_roles_cannot_update_comment(): void
    {
        $post = $this->createPost('Post for Update Blocked');
        $comment = Comment::query()->create([
            'post_id' => $post->id,
            'customer_name' => 'Original Commenter Blocked',
            'comment' => 'Original comment body',
            'status' => 'pending',
        ]);

        foreach (self::BLOCKED_ROLES as $role) {
            $this->actingAsRole($role);

            $response = $this->putJson("/api/admin/comments/{$comment->id}", [
                'post_id' => $post->id,
                'customer_name' => 'Original Commenter Blocked',
                'comment' => "Hacked by {$role}",
                'status' => 'approved',
            ]);

            $response->assertForbidden(
                "Role '{$role}' must be forbidden from updating comment (PUT /api/admin/comments/{$comment->id})."
            );
            $this->assertDatabaseHas('comments', [
                'id' => $comment->id,
                'comment' => 'Original comment body',
                'status' => 'pending',
            ]);
        }
    }

    public function test_allowed_roles_can_approve_comment(): void
    {
        $post = $this->createPost('Post for Approve');

        foreach (self::ALLOWED_ROLES as $role) {
            $comment = Comment::query()->create([
                'post_id' => $post->id,
                'customer_name' => "Approve Test {$role}",
                'comment' => 'Pending comment body',
                'status' => 'pending',
            ]);

            $this->actingAsRole($role);

            $response = $this->postJson("/api/admin/comments/{$comment->id}/approve");

            $response->assertOk(
                "Role '{$role}' must be permitted to approve comment (POST /api/admin/comments/{$comment->id}/approve)."
            );
            $this->assertDatabaseHas('comments', [
                'id' => $comment->id,
                'status' => 'approved',
            ]);
        }
    }

    public function test_blocked_roles_cannot_approve_comment(): void
    {
        $post = $this->createPost('Post for Approve Blocked');
        $comment = Comment::query()->create([
            'post_id' => $post->id,
            'customer_name' => 'Pending Commenter',
            'comment' => 'Pending comment body',
            'status' => 'pending',
        ]);

        foreach (self::BLOCKED_ROLES as $role) {
            $this->actingAsRole($role);

            $response = $this->postJson("/api/admin/comments/{$comment->id}/approve");

            $response->assertForbidden(
                "Role '{$role}' must be forbidden from approving comment (POST /api/admin/comments/{$comment->id}/approve)."
            );
            $this->assertDatabaseHas('comments', [
                'id' => $comment->id,
                'status' => 'pending',
            ]);
        }
    }

    public function test_allowed_roles_can_delete_comment(): void
    {
        $post = $this->createPost('Post for Delete');

        foreach (self::ALLOWED_ROLES as $role) {
            $comment = Comment::query()->create([
                'post_id' => $post->id,
                'customer_name' => "Comment to Delete by {$role}",
                'comment' => 'Will be deleted',
                'status' => 'approved',
            ]);

            $this->actingAsRole($role);

            $response = $this->deleteJson("/api/admin/comments/{$comment->id}");

            $response->assertNoContent();
            $this->assertDatabaseMissing('comments', [
                'id' => $comment->id,
            ]);
        }
    }

    public function test_blocked_roles_cannot_delete_comment(): void
    {
        $post = $this->createPost('Post for Delete Blocked');
        $comment = Comment::query()->create([
            'post_id' => $post->id,
            'customer_name' => 'Protected Comment',
            'comment' => 'Will NOT be deleted',
            'status' => 'approved',
        ]);

        foreach (self::BLOCKED_ROLES as $role) {
            $this->actingAsRole($role);

            $response = $this->deleteJson("/api/admin/comments/{$comment->id}");

            $response->assertForbidden(
                "Role '{$role}' must be forbidden from deleting comment (DELETE /api/admin/comments/{$comment->id})."
            );
            $this->assertDatabaseHas('comments', [
                'id' => $comment->id,
            ]);
        }
    }

    public function test_allowed_roles_can_bulk_delete_comments(): void
    {
        $post = $this->createPost('Post for Bulk Delete');

        foreach (self::ALLOWED_ROLES as $role) {
            $c1 = Comment::query()->create([
                'post_id' => $post->id,
                'customer_name' => "Bulk {$role} 1",
                'comment' => 'Bulk 1',
                'status' => 'approved',
            ]);
            $c2 = Comment::query()->create([
                'post_id' => $post->id,
                'customer_name' => "Bulk {$role} 2",
                'comment' => 'Bulk 2',
                'status' => 'approved',
            ]);

            $this->actingAsRole($role);

            $response = $this->postJson('/api/admin/comments/bulk-delete', [
                'ids' => [$c1->id, $c2->id],
            ]);

            $response->assertNoContent();

            $this->assertDatabaseMissing('comments', ['id' => $c1->id]);
            $this->assertDatabaseMissing('comments', ['id' => $c2->id]);
        }
    }

    public function test_blocked_roles_cannot_bulk_delete_comments(): void
    {
        $post = $this->createPost('Post for Bulk Delete Blocked');
        $c1 = Comment::query()->create([
            'post_id' => $post->id,
            'customer_name' => 'Protected Bulk 1',
            'comment' => 'Protected Bulk 1',
            'status' => 'approved',
        ]);
        $c2 = Comment::query()->create([
            'post_id' => $post->id,
            'customer_name' => 'Protected Bulk 2',
            'comment' => 'Protected Bulk 2',
            'status' => 'approved',
        ]);

        foreach (self::BLOCKED_ROLES as $role) {
            $this->actingAsRole($role);

            $response = $this->postJson('/api/admin/comments/bulk-delete', [
                'ids' => [$c1->id, $c2->id],
            ]);

            $response->assertForbidden(
                "Role '{$role}' must be forbidden from bulk deleting comments (POST /api/admin/comments/bulk-delete)."
            );

            $this->assertDatabaseHas('comments', ['id' => $c1->id]);
            $this->assertDatabaseHas('comments', ['id' => $c2->id]);
        }
    }

    public function test_migration_seeds_and_assigns_comment_permissions_to_core_roles_only(): void
    {
        $migration = require database_path('migrations/2026_09_21_000001_seed_comments_domain_permissions.php');
        $migration->up();

        $admin = Role::query()->where('name', 'admin')->where('guard_name', 'web')->first();
        $this->assertNotNull($admin);

        foreach (AdminAbilityRegistry::COMMENTS as $permission) {
            $this->assertTrue(
                $admin->hasPermissionTo($permission),
                "Admin must have permission '{$permission}' after migration."
            );
        }

        // Verify business roles do NOT have any comment permissions
        foreach (['Product Manager', 'Order Manager', 'Support'] as $businessRole) {
            $role = Role::query()->where('name', $businessRole)->where('guard_name', 'web')->first();
            $this->assertNotNull($role);

            foreach (AdminAbilityRegistry::COMMENTS as $permission) {
                $this->assertFalse(
                    $role->hasPermissionTo($permission),
                    "Business role '{$businessRole}' must NOT have permission '{$permission}'."
                );
            }
        }
    }

    public function test_unauthenticated_request_is_unauthorized_for_all_endpoints(): void
    {
        $post = $this->createPost('Post for Guest');
        $comment = Comment::query()->create([
            'post_id' => $post->id,
            'customer_name' => 'Guest Commenter',
            'comment' => 'Guest comment body',
            'status' => 'pending',
        ]);

        $this->getJson('/api/admin/comments')->assertUnauthorized();
        $this->postJson('/api/admin/comments', [
            'post_id' => $post->id,
            'customer_name' => 'Guest New',
            'comment' => 'Guest body',
            'status' => 'pending',
        ])->assertUnauthorized();
        $this->getJson("/api/admin/comments/{$comment->id}")->assertUnauthorized();
        $this->putJson("/api/admin/comments/{$comment->id}", [
            'post_id' => $post->id,
            'customer_name' => 'Guest Edit',
            'comment' => 'Guest updated',
            'status' => 'approved',
        ])->assertUnauthorized();
        $this->postJson("/api/admin/comments/{$comment->id}/approve")->assertUnauthorized();
        $this->deleteJson("/api/admin/comments/{$comment->id}")->assertUnauthorized();
        $this->postJson('/api/admin/comments/bulk-delete', [
            'ids' => [$comment->id],
        ])->assertUnauthorized();
    }

    private function createPost(string $title): Post
    {
        return Post::query()->create([
            'title' => $title,
            'slug' => Str::slug($title).'-'.uniqid(),
            'content' => 'Sample post content',
            'status' => 'published',
        ]);
    }

    private function actingAsRole(string $role): User
    {
        $user = User::factory()->create();
        $user->assignRole($role);
        Sanctum::actingAs($user);

        return $user;
    }
}
