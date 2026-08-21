<?php

namespace Tests\Feature\Api\Admin;

use App\Models\BlogCategory;
use App\Models\Post;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class PostControllerIndexTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Role::firstOrCreate(['name' => 'admin', 'guard_name' => 'web']);
        $user = User::factory()->create();
        $user->assignRole('admin');
        Sanctum::actingAs($user);
    }

    public function test_index_response_has_pagination_envelope(): void
    {
        $category = BlogCategory::factory()->create();
        Post::create([
            'blog_category_id' => $category->id,
            'title' => 'A Post', 'slug' => 'a-post', 'content' => '<p>x</p>', 'status' => 'draft',
        ]);

        $this->getJson('/api/admin/posts')
            ->assertOk()
            ->assertJsonStructure(['data', 'links', 'meta' => ['current_page', 'last_page', 'total']]);
    }

    public function test_index_filters_by_search(): void
    {
        $category = BlogCategory::factory()->create();
        Post::create([
            'blog_category_id' => $category->id,
            'title' => 'Feeding Your Senior Dog', 'slug' => 'feeding-senior-dog', 'content' => '<p>x</p>', 'status' => 'draft',
        ]);
        Post::create([
            'blog_category_id' => $category->id,
            'title' => 'Cat Grooming Tips', 'slug' => 'cat-grooming-tips', 'content' => '<p>x</p>', 'status' => 'draft',
        ]);

        $response = $this->getJson('/api/admin/posts?search=senior')->assertOk();

        $this->assertCount(1, $response->json('data'));
        $this->assertSame('Feeding Your Senior Dog', $response->json('data.0.title'));
    }

    public function test_index_includes_updated_at(): void
    {
        $category = BlogCategory::factory()->create();
        $post = Post::create([
            'blog_category_id' => $category->id,
            'title' => 'A Post', 'slug' => 'a-post', 'content' => '<p>x</p>', 'status' => 'draft',
        ]);

        $this->getJson('/api/admin/posts')
            ->assertOk()
            ->assertJsonPath('data.0.updated_at', $post->fresh()->updated_at->toISOString());
    }

    public function test_destroy_deletes_the_post(): void
    {
        $category = BlogCategory::factory()->create();
        $post = Post::create([
            'blog_category_id' => $category->id,
            'title' => 'A Post', 'slug' => 'a-post', 'content' => '<p>x</p>', 'status' => 'draft',
        ]);

        $this->deleteJson("/api/admin/posts/{$post->id}")->assertNoContent();

        $this->assertNull(Post::find($post->id));
    }
}
