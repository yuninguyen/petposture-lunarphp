<?php

namespace Tests\Feature;

use App\Models\BlogCategory;
use App\Models\Post;
use App\Models\SeoMetadata;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\URL;
use Tests\TestCase;

class FuturePostExposureTest extends TestCase
{
    use RefreshDatabase;

    public function test_public_post_seo_exposes_index_and_follow_flags_including_false(): void
    {
        $post = $this->createPost(now()->subHour());
        SeoMetadata::query()->create([
            'seoable_type' => Post::class,
            'seoable_id' => $post->id,
            'title' => 'Post SEO title',
            'is_indexable' => false,
            'is_followable' => false,
        ]);

        $this->getJson('/api/posts/'.$post->slug)
            ->assertOk()
            ->assertJsonPath('data.seo.is_indexable', false)
            ->assertJsonPath('data.seo.is_followable', false)
            ->assertJsonPath('data.seo.title', 'Post SEO title');
    }

    public function test_future_published_post_is_hidden_from_direct_slug_until_publish_time(): void
    {
        $post = $this->createPost(now()->addHour());

        $this->getJson("/api/posts/{$post->slug}")->assertNotFound();

        $post->update(['published_at' => now()->subSecond()]);
        $this->getJson("/api/posts/{$post->slug}")
            ->assertOk()
            ->assertJsonPath('data.slug', $post->slug);
    }

    public function test_valid_native_signature_can_view_a_future_post(): void
    {
        $post = $this->createPost(now()->addHour());
        $url = URL::temporarySignedRoute('posts.show', now()->addMinutes(15), [
            'slug' => $post->slug,
        ]);

        $this->getJson($url)
            ->assertOk()
            ->assertJsonPath('data.slug', $post->slug);

        $parts = parse_url($url);
        parse_str($parts['query'] ?? '', $tamperedQuery);
        $signature = (string) $tamperedQuery['signature'];
        $tamperedQuery['signature'] = ($signature[0] === '0' ? '1' : '0').substr($signature, 1);
        $this->getJson("/api/posts/{$post->slug}?".http_build_query($tamperedQuery))->assertNotFound();

        $expiredUrl = URL::temporarySignedRoute('posts.show', now()->subMinute(), [
            'slug' => $post->slug,
        ]);
        $this->getJson($expiredUrl)->assertNotFound();
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
