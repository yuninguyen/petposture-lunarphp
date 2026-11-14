<?php

namespace Tests\Feature;

use App\Models\BlogCategory;
use App\Models\BlogTag;
use App\Models\Post;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

/**
 * "Content Writer" drafts posts for an admin to review and publish. It is a
 * business role (not one of super_admin/admin/staff, which bypass every Gate check).
 */
class ContentWriterRoleTest extends TestCase
{
    use RefreshDatabase;

    private BlogCategory $category;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
        $this->category = BlogCategory::factory()->create();
        Sanctum::actingAs($this->userWithRole('Content Writer'));
    }

    public function test_the_role_exists_and_is_an_admin_panel_role(): void
    {
        $this->assertContains('Content Writer', User::ADMIN_PANEL_ROLES);
        // actingAs switches the default guard to sanctum, but roles live on the web guard.
        $role = Role::findByName('Content Writer', 'web');
        $this->assertTrue($role->hasPermissionTo('create_post'));
        $this->assertFalse($role->hasPermissionTo('publish_post'));
    }

    public function test_a_writer_can_list_create_open_and_update_a_draft(): void
    {
        $this->getJson('/api/admin/posts')->assertOk();

        $id = $this->postJson('/api/admin/posts', $this->payload(['slug' => 'writer-draft']))
            ->assertCreated()
            ->json('data.id');

        $this->getJson("/api/admin/posts/{$id}")->assertOk();
        $this->putJson("/api/admin/posts/{$id}", ['title' => 'Edited by the writer'])
            ->assertOk()
            ->assertJsonPath('data.title', 'Edited by the writer')
            ->assertJsonPath('data.status', 'draft');
    }

    public function test_a_writer_can_preview_their_draft(): void
    {
        $post = Post::query()->create($this->payload(['slug' => 'preview-me']));

        $this->getJson("/api/admin/posts/{$post->id}/preview-url")->assertOk()->assertJsonStructure(['url']);
    }

    public function test_a_writer_cannot_publish_a_post(): void
    {
        $this->postJson('/api/admin/posts', $this->payload(['slug' => 'born-published', 'status' => 'published']))
            ->assertForbidden();

        $post = Post::query()->create($this->payload(['slug' => 'will-not-publish']));
        $this->putJson("/api/admin/posts/{$post->id}", ['status' => 'published'])->assertForbidden();
        $this->assertSame('draft', $post->fresh()->status);
    }

    public function test_a_writer_cannot_edit_or_unpublish_a_post_that_is_already_live(): void
    {
        $live = Post::query()->create($this->payload(['slug' => 'already-live', 'status' => 'published', 'published_at' => now()->subDay()]));

        $this->putJson("/api/admin/posts/{$live->id}", ['title' => 'Changed under the readers'])->assertForbidden();
        $this->putJson("/api/admin/posts/{$live->id}", ['status' => 'draft'])->assertForbidden();

        $live->refresh();
        $this->assertNotSame('Changed under the readers', $live->title);
        $this->assertSame('published', $live->status);
    }

    public function test_a_writer_cannot_delete_posts_or_generate_ai_seo(): void
    {
        $post = Post::query()->create($this->payload(['slug' => 'keep-me']));

        $this->deleteJson("/api/admin/posts/{$post->id}")->assertForbidden();
        $this->postJson('/api/admin/posts/bulk-delete', ['ids' => [$post->id]])->assertForbidden();
        $this->postJson('/api/admin/posts/generate-seo', ['title' => 'x', 'content' => 'y'])->assertForbidden();
        $this->assertNotNull($post->fresh());
    }

    public function test_a_writer_can_use_what_the_post_form_needs(): void
    {
        $this->getJson('/api/admin/blog/tags')->assertOk();
        $this->postJson('/api/admin/blog/tags', ['name' => 'Writer tag', 'slug' => 'writer-tag'])->assertCreated();
        $this->getJson('/api/admin/blog/categories')->assertOk();
        $this->getJson('/api/admin/media')->assertOk();
        $this->getJson('/api/admin/breeds')->assertOk();
        $this->getJson('/api/admin/solutions')->assertOk();
        $this->getJson('/api/admin/affiliate-networks')->assertOk();
    }

    public function test_a_writer_cannot_change_categories_or_other_people_s_tags(): void
    {
        $tag = BlogTag::query()->create(['name' => 'Existing', 'slug' => 'existing']);

        $this->postJson('/api/admin/blog/categories', ['name' => 'New', 'slug' => 'new'])->assertForbidden();
        $this->putJson("/api/admin/blog/tags/{$tag->id}", ['name' => 'Renamed'])->assertForbidden();
        $this->deleteJson("/api/admin/blog/tags/{$tag->id}")->assertForbidden();
    }

    public function test_a_writer_cannot_reach_orders_customers_settings_people_or_roles(): void
    {
        foreach ([
            '/api/admin/orders',
            '/api/admin/customers',
            '/api/admin/products',
            '/api/admin/settings/general',
            '/api/admin/users',
            '/api/admin/system/users',
            '/api/admin/system/roles',
            '/api/admin/dashboard/sales',
            '/api/admin/discounts',
        ] as $path) {
            $this->getJson($path)->assertForbidden();
        }
    }

    private function payload(array $overrides = []): array
    {
        return array_merge([
            'blog_category_id' => $this->category->id,
            'title' => 'Writer post',
            'slug' => 'writer-'.uniqid(),
            'content' => '<p>Body</p>',
            'status' => 'draft',
            'type' => Post::TYPE_ARTICLE,
        ], $overrides);
    }

    private function userWithRole(string $role): User
    {
        $user = User::factory()->create();
        $user->assignRole($role);

        return $user;
    }
}
