<?php

namespace Tests\Feature\Api\Admin;

use App\Models\AffiliateNetwork;
use App\Models\BlogCategory;
use App\Models\BlogTag;
use App\Models\Breed;
use App\Models\Post;
use App\Models\Solution;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class PostControllerParityTest extends TestCase
{
    use RefreshDatabase;

    protected BlogCategory $category;

    protected function setUp(): void
    {
        parent::setUp();
        Role::firstOrCreate(['name' => 'admin', 'guard_name' => 'web']);
        $user = User::factory()->create();
        $user->assignRole('admin');
        Sanctum::actingAs($user);

        $this->category = BlogCategory::factory()->create();

        AffiliateNetwork::firstOrCreate(
            ['slug' => 'chewy'],
            ['name' => 'Chewy', 'active' => true],
        );
    }

    protected function basePayload(array $overrides = []): array
    {
        return array_merge([
            'blog_category_id' => $this->category->id,
            'title' => 'Parity Post',
            'slug' => 'parity-'.Str::random(6),
            'content' => '<p>Body</p>',
            'status' => 'draft',
            'type' => Post::TYPE_ARTICLE,
        ], $overrides);
    }

    // --- Section C: published_at ---

    public function test_store_respects_explicit_published_at_when_publishing(): void
    {
        $response = $this->postJson('/api/admin/posts', $this->basePayload([
            'status' => 'published',
            'published_at' => '2026-01-15 09:30:00',
        ]))->assertCreated();

        $this->assertStringStartsWith('2026-01-15T09:30:00', $response->json('data.published_at'));
    }

    public function test_store_auto_fills_published_at_when_publishing_without_one(): void
    {
        $response = $this->postJson('/api/admin/posts', $this->basePayload(['status' => 'published']))
            ->assertCreated();

        $this->assertNotNull($response->json('data.published_at'));
    }

    // --- Section D: SEO ---

    public function test_seo_round_trips_through_store_and_show(): void
    {
        $response = $this->postJson('/api/admin/posts', $this->basePayload([
            'seo' => [
                'title' => 'SEO Title',
                'keyphrase' => 'dog ramps',
                'description' => 'Meta description here',
                'og_title' => 'Social Title',
                'og_description' => 'Social description',
                'og_image' => 'https://cdn.test/social.webp',
            ],
        ]))->assertCreated();

        $this->assertSame('SEO Title', $response->json('data.seo.title'));
        $this->assertSame('https://cdn.test/social.webp', $response->json('data.seo.og_image'));

        $post = Post::find($response->json('data.id'));
        $this->assertSame('SEO Title', $post->seo->title);
        $this->assertSame('dog ramps', $post->seo->keyphrase);

        $this->getJson("/api/admin/posts/{$post->id}")
            ->assertOk()
            ->assertJsonPath('data.seo.description', 'Meta description here');
    }

    public function test_seo_update_upserts_instead_of_duplicating(): void
    {
        $post = Post::create([
            'blog_category_id' => $this->category->id,
            'title' => 'Existing', 'slug' => 'existing-'.Str::random(4), 'content' => '<p>x</p>', 'status' => 'draft',
        ]);
        $post->seo()->create(['title' => 'Old Title']);

        $this->putJson("/api/admin/posts/{$post->id}", [
            'seo' => ['title' => 'New Title'],
        ])->assertOk();

        $this->assertDatabaseCount('seo_metadata', 1);
        $this->assertSame('New Title', $post->fresh()->seo->title);
    }

    public function test_seo_title_over_60_chars_is_rejected(): void
    {
        $this->postJson('/api/admin/posts', $this->basePayload([
            'seo' => ['title' => str_repeat('a', 61)],
        ]))
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['seo.title']);
    }

    public function test_seo_description_over_160_chars_is_rejected(): void
    {
        $this->postJson('/api/admin/posts', $this->basePayload([
            'seo' => ['description' => str_repeat('a', 161)],
        ]))
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['seo.description']);
    }

    // --- Section E: Duplicate ---

    public function test_duplicate_copies_all_fields_metadata_taxonomy_and_seo(): void
    {
        $breed = Breed::create(['name' => 'Dachshund', 'slug' => 'dachshund', 'body_type' => 'long-backed']);
        $solution = Solution::create(['name' => 'Mobility', 'slug' => 'mobility']);
        $tag = BlogTag::create(['name' => 'Guides', 'slug' => 'guides']);

        $post = Post::create([
            'blog_category_id' => $this->category->id,
            'title' => 'Original Post',
            'slug' => 'original-post',
            'content' => '<p>Body</p>',
            'status' => 'published',
            'type' => Post::TYPE_COMPARISON,
            'published_at' => now(),
        ]);
        $post->setMeta('comparison_intro', 'Intro text');
        $post->setMeta('disclosure_shown', '1', 'bool');
        $post->setMeta('comparison_items', [[
            'product_name' => 'Orthopedic Bed',
            'retailer' => 'chewy',
            'in_stock' => true,
            'affiliate_url' => 'https://chewy.com/p/1',
        ]], 'json');
        $post->breeds()->sync([$breed->id]);
        $post->solutions()->sync([$solution->id]);
        $post->tags()->sync([$tag->id]);
        $post->seo()->create(['title' => 'Original SEO', 'keyphrase' => 'ramps']);

        $response = $this->postJson("/api/admin/posts/{$post->id}/duplicate")->assertCreated();
        $replica = Post::find($response->json('data.id'));

        $this->assertSame('Original Post (Copy)', $replica->title);
        $this->assertNotSame($post->slug, $replica->slug);
        $this->assertSame('draft', $replica->status);
        $this->assertNull($replica->published_at);
        $this->assertSame('Intro text', $replica->getMeta('comparison_intro'));
        $this->assertTrue($replica->getMeta('disclosure_shown'));
        $this->assertSame('Orthopedic Bed', $replica->getMeta('comparison_items')[0]['product_name']);
        $this->assertSame([$breed->id], $replica->breeds->pluck('id')->all());
        $this->assertSame([$solution->id], $replica->solutions->pluck('id')->all());
        $this->assertSame([$tag->id], $replica->tags->pluck('id')->all());
        $this->assertSame('Original SEO', $replica->seo->title);
        $this->assertSame('ramps', $replica->seo->keyphrase);
    }

    public function test_editing_the_replica_does_not_mutate_the_original(): void
    {
        $post = Post::create([
            'blog_category_id' => $this->category->id,
            'title' => 'Original Post',
            'slug' => 'original-post-2',
            'content' => '<p>Body</p>',
            'status' => 'draft',
        ]);
        $post->setMeta('comparison_intro', 'Original intro');
        $post->seo()->create(['title' => 'Original SEO']);

        $replica = Post::find($this->postJson("/api/admin/posts/{$post->id}/duplicate")->json('data.id'));

        $replica->seo()->update(['title' => 'Replica SEO']);
        $replica->setMeta('comparison_intro', 'Replica intro');

        $this->assertSame('Original SEO', $post->fresh()->seo->title);
        $this->assertSame('Original intro', $post->fresh()->getMeta('comparison_intro'));
    }

    // --- Section F1: type filter ---

    public function test_index_filters_by_type(): void
    {
        Post::create([
            'blog_category_id' => $this->category->id,
            'title' => 'A Comparison', 'slug' => 'a-comparison', 'content' => '<p>x</p>',
            'status' => 'draft', 'type' => Post::TYPE_COMPARISON,
        ]);
        Post::create([
            'blog_category_id' => $this->category->id,
            'title' => 'A Guide', 'slug' => 'a-guide', 'content' => '<p>x</p>',
            'status' => 'draft', 'type' => Post::TYPE_GUIDE,
        ]);

        $response = $this->getJson('/api/admin/posts?type=comparison')->assertOk();

        $this->assertCount(1, $response->json('data'));
        $this->assertSame(Post::TYPE_COMPARISON, $response->json('data.0.type'));
    }

    // --- Section F2: out-of-stock flag ---

    public function test_out_of_stock_flag_reflects_comparison_items(): void
    {
        $post = Post::create([
            'blog_category_id' => $this->category->id,
            'title' => 'Comparison', 'slug' => 'comparison-'.Str::random(4), 'content' => '<p>x</p>',
            'status' => 'draft', 'type' => Post::TYPE_COMPARISON,
        ]);
        $post->setMeta('comparison_items', [['in_stock' => false]], 'json');

        $this->getJson("/api/admin/posts/{$post->id}")
            ->assertOk()
            ->assertJsonPath('data.has_out_of_stock_comparison_items', true);

        $post->setMeta('comparison_items', [['in_stock' => true]], 'json');

        $this->getJson("/api/admin/posts/{$post->id}")
            ->assertOk()
            ->assertJsonPath('data.has_out_of_stock_comparison_items', false);
    }

    // --- Section F3: bulk delete ---

    public function test_bulk_destroy_deletes_only_the_given_ids(): void
    {
        $a = Post::create([
            'blog_category_id' => $this->category->id,
            'title' => 'A', 'slug' => 'bulk-a', 'content' => '<p>x</p>', 'status' => 'draft',
        ]);
        $b = Post::create([
            'blog_category_id' => $this->category->id,
            'title' => 'B', 'slug' => 'bulk-b', 'content' => '<p>x</p>', 'status' => 'draft',
        ]);
        $c = Post::create([
            'blog_category_id' => $this->category->id,
            'title' => 'C', 'slug' => 'bulk-c', 'content' => '<p>x</p>', 'status' => 'draft',
        ]);

        $this->postJson('/api/admin/posts/bulk-delete', ['ids' => [$a->id, $c->id]])->assertNoContent();

        $this->assertNull(Post::find($a->id));
        $this->assertNotNull(Post::find($b->id));
        $this->assertNull(Post::find($c->id));
    }

    public function test_bulk_destroy_rejects_invalid_ids(): void
    {
        $this->postJson('/api/admin/posts/bulk-delete', ['ids' => [99999]])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['ids.0']);
    }

    // --- Section G: read_time ---

    public function test_read_time_is_auto_computed_on_store(): void
    {
        $content = '<p>'.str_repeat('word ', 500).'</p>';

        $response = $this->postJson('/api/admin/posts', $this->basePayload(['content' => $content]))->assertCreated();

        $this->assertSame(Post::estimateReadTime($content), $response->json('data.read_time'));
    }

    public function test_read_time_recomputed_on_update_when_content_changes(): void
    {
        $post = Post::create([
            'blog_category_id' => $this->category->id,
            'title' => 'Existing', 'slug' => 'rt-'.Str::random(4), 'content' => '<p>Short</p>', 'status' => 'draft',
        ]);
        $content = '<p>'.str_repeat('word ', 500).'</p>';

        $this->putJson("/api/admin/posts/{$post->id}", ['content' => $content])->assertOk();

        $this->assertSame(Post::estimateReadTime($content), $post->fresh()->read_time);
    }

    // --- Slug uniqueness (added with the admin Slug field) ---

    public function test_store_rejects_duplicate_slug(): void
    {
        Post::create([
            'blog_category_id' => $this->category->id,
            'title' => 'Existing', 'slug' => 'my-post', 'content' => '<p>x</p>', 'status' => 'draft',
        ]);

        $this->postJson('/api/admin/posts', $this->basePayload(['slug' => 'my-post']))
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['slug']);
    }

    public function test_update_allows_keeping_the_same_slug(): void
    {
        $post = Post::create([
            'blog_category_id' => $this->category->id,
            'title' => 'Existing', 'slug' => 'my-post', 'content' => '<p>x</p>', 'status' => 'draft',
        ]);

        $this->putJson("/api/admin/posts/{$post->id}", ['slug' => 'my-post'])->assertOk();
    }
}
