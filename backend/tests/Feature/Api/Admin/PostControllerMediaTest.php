<?php

namespace Tests\Feature\Api\Admin;

use App\Models\BlogCategory;
use App\Models\CuratorMedia;
use App\Models\Post;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class PostControllerMediaTest extends TestCase
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

    public function test_creating_a_post_with_featured_media_id_links_it(): void
    {
        $category = BlogCategory::factory()->create();
        $media = CuratorMedia::create([
            'disk' => 'public', 'directory' => 'media', 'visibility' => 'public',
            'name' => 'photo.jpg', 'path' => 'media/photo.jpg', 'type' => 'image', 'ext' => 'jpg',
        ]);

        $response = $this->postJson('/api/admin/posts', [
            'title' => 'A Post With A Real Image',
            'content' => '<p>Body</p>',
            'blog_category_id' => $category->id,
            'featured_media_id' => $media->id,
            'status' => 'draft',
        ])->assertCreated();

        $post = Post::find($response->json('data.id'));
        $this->assertSame($media->id, $post->featured_media_id);
    }

    public function test_updating_a_post_can_change_featured_media_id(): void
    {
        $category = BlogCategory::factory()->create();
        $post = Post::create([
            'blog_category_id' => $category->id,
            'title' => 'Existing', 'slug' => 'existing', 'content' => '<p>x</p>', 'status' => 'draft',
        ]);
        $media = CuratorMedia::create([
            'disk' => 'public', 'directory' => 'media', 'visibility' => 'public',
            'name' => 'photo.jpg', 'path' => 'media/photo.jpg', 'type' => 'image', 'ext' => 'jpg',
        ]);

        $this->putJson("/api/admin/posts/{$post->id}", ['featured_media_id' => $media->id])
            ->assertOk();

        $this->assertSame($media->id, $post->fresh()->featured_media_id);
    }

    public function test_show_response_includes_featured_media_id(): void
    {
        $category = BlogCategory::factory()->create();
        $media = CuratorMedia::create([
            'disk' => 'public', 'directory' => 'media', 'visibility' => 'public',
            'name' => 'photo.jpg', 'path' => 'media/photo.jpg', 'type' => 'image', 'ext' => 'jpg',
        ]);
        $post = Post::create([
            'blog_category_id' => $category->id,
            'title' => 'Existing', 'slug' => 'existing', 'content' => '<p>x</p>', 'status' => 'draft',
            'featured_media_id' => $media->id,
        ]);

        $this->getJson("/api/admin/posts/{$post->id}")
            ->assertOk()
            ->assertJsonPath('data.featured_media_id', (string) $media->id);
    }
}
