<?php

namespace Tests\Feature\Api\Admin;

use App\Models\AffiliateNetwork;
use App\Models\BlogCategory;
use App\Models\Post;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class PostControllerComparisonTest extends TestCase
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

        // The affiliate_networks migration already seeds a 'chewy' network, so
        // firstOrCreate (not create) avoids a unique-slug violation.
        AffiliateNetwork::firstOrCreate(
            ['slug' => 'chewy'],
            ['name' => 'Chewy', 'active' => true],
        );
    }

    protected function basePayload(array $overrides = []): array
    {
        return array_merge([
            'blog_category_id' => $this->category->id,
            'title' => 'Best Orthopedic Dog Beds',
            'slug' => 'best-orthopedic-dog-beds',
            'content' => '<p>Intro</p>',
            'status' => 'draft',
            'type' => Post::TYPE_ARTICLE,
        ], $overrides);
    }

    protected function comparisonItem(array $overrides = []): array
    {
        return array_merge([
            'product_name' => 'Orthopedic Bed',
            'image_url' => 'https://cdn.test/bed.webp',
            'retailer' => 'chewy',
            'highlight' => 'Best Value',
            'in_stock' => true,
            'price_display' => '$64.99',
            'price_cents' => 6499,
            'rating' => 4.7,
            'affiliate_url' => 'https://chewy.com/product/123',
            'pros' => ['comfy', 'washable'],
            'cons' => ['pricey'],
            'in_house_match_url' => null,
        ], $overrides);
    }

    public function test_type_defaults_to_article_when_not_provided(): void
    {
        $payload = $this->basePayload();
        unset($payload['type']);

        $response = $this->postJson('/api/admin/posts', $payload)->assertCreated();

        $this->assertSame(Post::TYPE_ARTICLE, $response->json('data.type'));
    }

    public function test_store_persists_type_and_comparison_items(): void
    {
        $payload = $this->basePayload([
            'type' => Post::TYPE_COMPARISON,
            'comparison_intro' => 'Here are our top picks.',
            'disclosure_shown' => true,
            'comparison_items' => [$this->comparisonItem()],
        ]);

        $response = $this->postJson('/api/admin/posts', $payload)->assertCreated();

        $this->assertSame(Post::TYPE_COMPARISON, $response->json('data.type'));
        $this->assertSame('Here are our top picks.', $response->json('data.comparison.intro'));
        $this->assertTrue($response->json('data.comparison.disclosure_shown'));
        $this->assertCount(1, $response->json('data.comparison.items'));
        $this->assertSame('Orthopedic Bed', $response->json('data.comparison.items.0.product_name'));
        $this->assertSame(4.7, $response->json('data.comparison.items.0.rating'));
        $this->assertSame(6499, $response->json('data.comparison.items.0.price_cents'));

        $post = Post::where('slug', 'best-orthopedic-dog-beds')->firstOrFail();
        $this->assertSame(Post::TYPE_COMPARISON, $post->type);
    }

    public function test_show_response_includes_comparison_data(): void
    {
        $post = Post::create([
            'blog_category_id' => $this->category->id,
            'title' => 'A Post', 'slug' => 'a-post', 'content' => '<p>x</p>',
            'status' => 'draft', 'type' => Post::TYPE_COMPARISON,
        ]);
        $post->setMeta('comparison_intro', 'Intro text');
        $post->setMeta('disclosure_shown', '1', 'bool');
        $post->setMeta('comparison_items', [$this->comparisonItem()], 'json');

        $this->getJson("/api/admin/posts/{$post->id}")
            ->assertOk()
            ->assertJsonPath('data.comparison.intro', 'Intro text')
            ->assertJsonPath('data.comparison.items.0.product_name', 'Orthopedic Bed');
    }

    public function test_update_overwrites_comparison_items(): void
    {
        $post = Post::create([
            'blog_category_id' => $this->category->id,
            'title' => 'A Post', 'slug' => 'a-post', 'content' => '<p>x</p>',
            'status' => 'draft', 'type' => Post::TYPE_COMPARISON,
        ]);
        $post->setMeta('comparison_items', [$this->comparisonItem(['product_name' => 'Old Item'])], 'json');

        $payload = $this->basePayload([
            'slug' => 'a-post',
            'type' => Post::TYPE_COMPARISON,
            'comparison_intro' => 'Updated intro',
            'disclosure_shown' => false,
            'comparison_items' => [$this->comparisonItem(['product_name' => 'New Item'])],
        ]);

        $response = $this->putJson("/api/admin/posts/{$post->id}", $payload)->assertOk();

        $this->assertCount(1, $response->json('data.comparison.items'));
        $this->assertSame('New Item', $response->json('data.comparison.items.0.product_name'));
        $this->assertFalse($response->json('data.comparison.disclosure_shown'));
    }

    public function test_article_type_post_does_not_require_comparison_fields(): void
    {
        $this->postJson('/api/admin/posts', $this->basePayload(['type' => Post::TYPE_ARTICLE]))
            ->assertCreated();
    }

    public function test_store_rejects_comparison_item_missing_product_name(): void
    {
        $payload = $this->basePayload([
            'type' => Post::TYPE_COMPARISON,
            'comparison_items' => [$this->comparisonItem(['product_name' => ''])],
        ]);

        $this->postJson('/api/admin/posts', $payload)
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['comparison_items.0.product_name']);
    }

    public function test_store_rejects_comparison_item_with_unknown_retailer_slug(): void
    {
        $payload = $this->basePayload([
            'type' => Post::TYPE_COMPARISON,
            'comparison_items' => [$this->comparisonItem(['retailer' => 'not-a-real-retailer'])],
        ]);

        $this->postJson('/api/admin/posts', $payload)
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['comparison_items.0.retailer']);
    }

    public function test_store_rejects_comparison_item_with_rating_out_of_range(): void
    {
        $payload = $this->basePayload([
            'type' => Post::TYPE_COMPARISON,
            'comparison_items' => [$this->comparisonItem(['rating' => 6])],
        ]);

        $this->postJson('/api/admin/posts', $payload)
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['comparison_items.0.rating']);
    }

    public function test_store_rejects_comparison_item_with_invalid_affiliate_url(): void
    {
        $payload = $this->basePayload([
            'type' => Post::TYPE_COMPARISON,
            'comparison_items' => [$this->comparisonItem(['affiliate_url' => 'not-a-url'])],
        ]);

        $this->postJson('/api/admin/posts', $payload)
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['comparison_items.0.affiliate_url']);
    }
}
