<?php

namespace Tests\Feature;

use App\Models\BlogCategory;
use App\Models\Post;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class FuturePostExposureTest extends TestCase
{
    use RefreshDatabase;

    public function test_future_published_post_is_hidden_from_direct_slug_until_publish_time(): void
    {
        $post = $this->createPost(now()->addHour());

        $this->getJson("/api/posts/{$post->slug}")->assertNotFound();
        $this->getJson("/api/v1/posts/{$post->slug}")->assertNotFound();

        $post->update(['published_at' => now()->subSecond()]);
        $this->getJson("/api/posts/{$post->slug}")
            ->assertOk()
            ->assertJsonPath('data.slug', $post->slug);
    }

    public function test_valid_preview_token_can_view_a_future_post(): void
    {
        $post = $this->createPost(now()->addHour());
        $expires = now()->addMinutes(15)->timestamp;
        $token = hash_hmac('sha256', $post->slug.'|'.$expires, config('app.key'));

        $this->getJson("/api/posts/{$post->slug}?expires={$expires}&preview_token={$token}")
            ->assertOk()
            ->assertJsonPath('data.slug', $post->slug);
    }

    private function createPost($publishedAt): Post
    {
        $category = BlogCategory::factory()->create();

        return Post::query()->create([
            'blog_category_id' => $category->id,
            'type' => Post::TYPE_ARTICLE,
            'title' => 'Scheduled post',
            'slug' => 'scheduled-post',
            'content' => '<p>Future content.</p>',
            'author' => 'PetPosture',
            'read_time' => '1 min read',
            'status' => 'published',
            'published_at' => $publishedAt,
        ]);
    }
}
