<?php

namespace Tests\Feature\Api\Admin;

use App\Models\AffiliateNetwork;
use App\Models\BlogCategory;
use App\Models\Post;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
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
            'highlight' => 'best_value',
            'in_stock' => true,
            'price_display' => '$64.99',
            'price_cents' => 6499,
            'rating' => 4.7,
            'affiliate_url' => 'https://chewy.com/product/123',
            'metadata' => [
                'source_url' => 'https://chewy.com/product/123',
                'checked_at' => '2025-01-15T12:00:00Z',
            ],
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
        $this->assertTrue($response->json('data.comparison.disclosure_shown'));
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

    public function test_store_rejects_price_without_valid_provenance(): void
    {
        foreach ([
            ['metadata' => []],
            ['metadata' => ['source_url' => 'not-a-url', 'checked_at' => '2025-01-15T12:00:00Z']],
            ['metadata' => ['source_url' => 'https://example.com', 'checked_at' => 'not-a-date']],
        ] as $override) {
            $this->postJson('/api/admin/posts', $this->basePayload([
                'slug' => 'provenance-'.Str::random(8),
                'type' => Post::TYPE_COMPARISON,
                'comparison_items' => [$this->comparisonItem($override)],
            ]))->assertUnprocessable();
        }
    }

    public function test_store_rejects_date_only_provenance_timestamp(): void
    {
        $this->postJson('/api/admin/posts', $this->basePayload([
            'type' => Post::TYPE_COMPARISON,
            'comparison_items' => [$this->comparisonItem([
                'metadata' => ['source_url' => 'https://chewy.com/product/123', 'checked_at' => '2025-01-15'],
            ])],
        ]))->assertUnprocessable()
            ->assertJsonValidationErrors(['comparison_items.0.metadata.checked_at']);
    }

    public function test_store_preserves_items_without_price_or_rating_and_exposes_provenance(): void
    {
        $item = $this->comparisonItem();
        unset($item['price_display'], $item['price_cents'], $item['rating'], $item['metadata']);
        $response = $this->postJson('/api/admin/posts', $this->basePayload([
            'type' => Post::TYPE_COMPARISON,
            'comparison_items' => [$item],
        ]))->assertCreated();
        $this->assertArrayNotHasKey('metadata', $response->json('data.comparison.items.0'));
    }

    public function test_disclosure_false_cannot_render_false_with_affiliate_link(): void
    {
        $response = $this->postJson('/api/admin/posts', $this->basePayload([
            'type' => Post::TYPE_COMPARISON,
            'disclosure_shown' => false,
            'comparison_items' => [$this->comparisonItem()],
        ]))->assertCreated();
        $this->assertTrue($response->json('data.comparison.disclosure_shown'));
    }

    public function test_disclosure_false_remains_allowed_without_affiliate_link(): void
    {
        $item = $this->comparisonItem(['affiliate_url' => null]);
        $response = $this->postJson('/api/admin/posts', $this->basePayload([
            'type' => Post::TYPE_COMPARISON,
            'disclosure_shown' => false,
            'comparison_items' => [$item],
        ]))->assertCreated();
        $this->assertFalse($response->json('data.comparison.disclosure_shown'));
    }

    public function test_store_rejects_highlight_value_over_max_length(): void
    {
        $payload = $this->basePayload([
            'type' => Post::TYPE_COMPARISON,
            'comparison_items' => [$this->comparisonItem(['highlight' => str_repeat('a', 41)])],
        ]);

        $this->postJson('/api/admin/posts', $payload)
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['comparison_items.0.highlight']);
    }

    public function test_store_accepts_free_text_highlight_values_and_empty(): void
    {
        foreach (['Best Value', 'Editor\'s Pick', null, ''] as $index => $highlight) {
            $this->postJson('/api/admin/posts', $this->basePayload([
                'slug' => 'highlight-'.$index.'-'.Str::random(4),
                'type' => Post::TYPE_COMPARISON,
                'comparison_items' => [$this->comparisonItem(['highlight' => $highlight])],
            ]))->assertCreated();
        }
    }
}
