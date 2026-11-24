<?php

namespace Tests\Feature;

use App\Models\AffiliateNetwork;
use App\Models\BlogCategory;
use App\Models\Post;
use App\Models\User;
use App\Support\PickKind;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Lunar\FieldTypes\Text;
use Lunar\Models\Currency;
use Lunar\Models\Language;
use Lunar\Models\Product;
use Lunar\Models\ProductType;
use Lunar\Models\TaxClass;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

// The Picks a post mentions: set from the post, shown on both sides, only while both sides are live.
class PostPickLinksTest extends TestCase
{
    use RefreshDatabase;

    private BlogCategory $category;

    protected function setUp(): void
    {
        parent::setUp();
        Role::firstOrCreate(['name' => 'admin', 'guard_name' => 'web']);
        $user = User::factory()->create();
        $user->assignRole('admin');
        Sanctum::actingAs($user);
        AffiliateNetwork::query()->firstOrCreate(['slug' => 'chewy'], ['name' => 'Chewy', 'active' => true]);
        $this->category = BlogCategory::factory()->create(['name' => 'Breed Guides']);
    }

    private function pick(string $slug, string $name, string $status = 'published', ?string $url = 'https://www.chewy.com/x/dp/1'): Product
    {
        $currency = Currency::query()->firstOrCreate(['code' => 'USD'], [
            'name' => 'US Dollar', 'exchange_rate' => 1, 'decimal_places' => 2, 'enabled' => true, 'default' => true, 'sync_prices' => false,
        ]);
        $taxClass = TaxClass::query()->firstOrCreate(['name' => 'Default Tax'], ['default' => true]);
        $type = ProductType::query()->firstOrCreate(['name' => 'Pets']);
        $language = Language::query()->firstOrCreate(['code' => 'en'], ['name' => 'English', 'default' => true]);

        $fields = ['name' => $name, 'reference_price' => '25.99', 'price_checked_date' => '2026-11-14', 'affiliate_network_slug' => 'chewy'];
        if ($url !== null) {
            $fields['external_url'] = $url;
        }
        $attributes = [];
        foreach ($fields as $handle => $value) {
            $attributes[$handle] = new Text($value);
        }

        $product = Product::query()->create(['product_type_id' => $type->id, 'status' => $status, 'attribute_data' => $attributes]);
        $product->urls()->delete();
        $product->urls()->create(['language_id' => $language->id, 'slug' => $slug, 'default' => true]);
        $variant = $product->variants()->create([
            'tax_class_id' => $taxClass->id, 'sku' => "SKU-{$slug}", 'stock' => 5, 'backorder' => 0,
            'purchasable' => 'always', 'unit_quantity' => 1, 'min_quantity' => 1, 'quantity_increment' => 1,
            'shippable' => true, 'attribute_data' => [],
        ]);
        $variant->prices()->create(['currency_id' => $currency->id, 'customer_group_id' => null, 'min_quantity' => 1, 'price' => 2599]);

        return $product;
    }

    private function makePost(string $slug, string $status = 'published', ?string $publishedAt = '-1 day'): Post
    {
        return Post::create([
            'blog_category_id' => $this->category->id, 'title' => "Post {$slug}", 'slug' => $slug, 'content' => '<p>Body</p>',
            'status' => $status, 'published_at' => $publishedAt ? now()->modify($publishedAt) : null, 'read_time' => '5 min read',
        ]);
    }

    private function payload(array $overrides = []): array
    {
        return array_merge([
            'blog_category_id' => $this->category->id, 'title' => 'Linked', 'slug' => 'linked', 'content' => '<p>Body</p>', 'status' => 'draft',
        ], $overrides);
    }

    // ---- admin: saving the links -------------------------------------------------------------------------------

    public function test_creating_and_updating_a_post_saves_the_chosen_picks_and_the_edit_form_gets_them_back(): void
    {
        $a = $this->pick('bowl-a', 'Bowl A');
        $b = $this->pick('bowl-b', 'Bowl B');

        $id = $this->postJson('/api/admin/posts', $this->payload(['product_ids' => [$a->id]]))->assertCreated()->json('data.id');
        $this->assertSame([$a->id], Post::find($id)->products->pluck('id')->all());

        $this->putJson("/api/admin/posts/{$id}", ['product_ids' => [$a->id, $b->id]])->assertOk();
        $this->assertEqualsCanonicalizing([$a->id, $b->id], $this->getJson("/api/admin/posts/{$id}")->assertOk()->json('data.product_ids'));
    }

    public function test_a_save_without_product_ids_leaves_the_links_alone_and_an_empty_list_clears_them(): void
    {
        $a = $this->pick('bowl-a', 'Bowl A');
        $post = $this->makePost('keeps-links', 'draft', null);
        $post->products()->sync([$a->id]);

        $this->putJson("/api/admin/posts/{$post->id}", ['title' => 'Renamed'])->assertOk();
        $this->assertSame([$a->id], $post->fresh()->products->pluck('id')->all());

        $this->putJson("/api/admin/posts/{$post->id}", ['product_ids' => []])->assertOk();
        $this->assertSame([], $post->fresh()->products->pluck('id')->all());
    }

    public function test_only_picks_can_be_linked(): void
    {
        $shopProduct = $this->pick('shop-item', 'Shop item', 'published', null);
        $this->assertSame('shop', PickKind::of($shopProduct));

        $this->postJson('/api/admin/posts', $this->payload(['product_ids' => [$shopProduct->id]]))
            ->assertUnprocessable()->assertJsonValidationErrors('product_ids.0');
        $this->postJson('/api/admin/posts', $this->payload(['product_ids' => [999999]]))->assertUnprocessable();
    }

    public function test_a_draft_pick_that_is_already_linked_stays_linked_when_the_post_is_saved_again(): void
    {
        $draft = $this->pick('draft-bowl', 'Draft bowl', 'draft');
        $post = $this->makePost('keeps-draft-pick', 'draft', null);
        $post->products()->sync([$draft->id]);

        $this->putJson("/api/admin/posts/{$post->id}", ['product_ids' => [$draft->id]])->assertOk();
        $this->assertSame([$draft->id], $post->fresh()->products->pluck('id')->all());
    }

    public function test_duplicating_a_post_copies_its_links(): void
    {
        $a = $this->pick('bowl-a', 'Bowl A');
        $post = $this->makePost('original');
        $post->products()->sync([$a->id]);

        $copyId = $this->postJson("/api/admin/posts/{$post->id}/duplicate")->assertCreated()->json('data.id');

        $this->assertSame([$a->id], Post::find($copyId)->products->pluck('id')->all());
    }

    // ---- admin: the choices -------------------------------------------------------------------------------------

    public function test_the_picker_lists_published_picks_only_with_brand_name_and_price(): void
    {
        $this->pick('necoichi', 'Necoichi Tilted Elevated Bowl');
        $this->pick('puppia', 'Puppia Vest', 'draft');
        $this->pick('shop-item', 'Shop item', 'published', null);

        $data = $this->getJson('/api/admin/posts/pick-options')->assertOk()->json('data');

        $this->assertCount(1, $data);
        $this->assertSame('Necoichi Tilted Elevated Bowl', $data[0]['name']);
        $this->assertSame(25.99, $data[0]['reference_price']);
        $this->assertArrayHasKey('brand', $data[0]);
        $this->assertArrayHasKey('thumbnail', $data[0]);
    }

    public function test_the_picker_needs_the_post_permission(): void
    {
        $this->app['auth']->forgetGuards();
        Sanctum::actingAs(User::factory()->create());

        $this->getJson('/api/admin/posts/pick-options')->assertForbidden();
    }

    // ---- storefront: the article --------------------------------------------------------------------------------

    public function test_an_article_lists_its_published_picks_in_the_order_they_were_chosen(): void
    {
        $first = $this->pick('first-bowl', 'First bowl');
        $second = $this->pick('second-bowl', 'Second bowl');
        $post = $this->makePost('guide');
        $post->products()->attach($second->id);
        $post->products()->attach($first->id);

        $picks = $this->getJson('/api/posts/guide')->assertOk()->json('data.picks');

        $this->assertSame(['second-bowl', 'first-bowl'], array_column($picks, 'slug'));
        $this->assertNotNull($picks[0]['pick']);
    }

    public function test_an_unpublished_pick_leaves_the_article_and_comes_back_when_published_again(): void
    {
        $bowl = $this->pick('bowl', 'Bowl');
        $post = $this->makePost('guide');
        $post->products()->attach($bowl->id);

        $bowl->update(['status' => 'draft']);
        $this->assertSame([], $this->getJson('/api/posts/guide')->json('data.picks'));
        $this->assertDatabaseHas('post_product', ['post_id' => $post->id, 'lunar_product_id' => $bowl->id]);

        $bowl->update(['status' => 'published']);
        $this->assertCount(1, $this->getJson('/api/posts/guide')->json('data.picks'));
    }

    public function test_an_article_without_links_has_an_empty_list_and_the_listing_does_not_carry_picks(): void
    {
        $this->makePost('plain');

        $this->assertSame([], $this->getJson('/api/posts/plain')->assertOk()->json('data.picks'));
        $this->assertArrayNotHasKey('picks', $this->getJson('/api/posts')->assertOk()->json('data.0'));
    }

    // ---- storefront: the Pick -------------------------------------------------------------------------------------

    public function test_a_pick_lists_the_live_posts_that_mention_it_with_what_a_card_needs(): void
    {
        $bowl = $this->pick('bowl', 'Bowl');
        $post = $this->makePost('guide');
        $post->products()->attach($bowl->id);

        $mentioned = $this->getJson('/api/products/bowl')->assertOk()->json('mentioned_in');

        $this->assertCount(1, $mentioned);
        $this->assertSame('guide', $mentioned[0]['slug']);
        $this->assertSame('Post guide', $mentioned[0]['title']);
        $this->assertSame('Breed Guides', $mentioned[0]['category']);
        $this->assertSame('5 min read', $mentioned[0]['read_time']);
        $this->assertNotNull($mentioned[0]['published_at']);
        $this->assertArrayNotHasKey('content', $mentioned[0]);
    }

    public function test_a_draft_scheduled_or_unpublished_post_does_not_show_on_the_pick_and_returns_when_live_again(): void
    {
        $bowl = $this->pick('bowl', 'Bowl');
        $draft = $this->makePost('draft-guide', 'draft', null);
        $future = $this->makePost('future-guide', 'published', '+2 days');
        $live = $this->makePost('live-guide');
        foreach ([$draft, $future, $live] as $post) {
            $post->products()->attach($bowl->id);
        }

        $this->assertSame(['live-guide'], array_column($this->getJson('/api/products/bowl')->json('mentioned_in'), 'slug'));

        $live->update(['status' => 'draft']);
        $this->assertSame([], $this->getJson('/api/products/bowl')->json('mentioned_in'));

        $live->update(['status' => 'published']);
        $this->assertSame(['live-guide'], array_column($this->getJson('/api/products/bowl')->json('mentioned_in'), 'slug'));
    }

    public function test_a_pick_nobody_mentions_has_an_empty_list(): void
    {
        $this->pick('lonely', 'Lonely');

        $this->assertSame([], $this->getJson('/api/products/lonely')->assertOk()->json('mentioned_in'));
    }

    public function test_deleting_a_post_removes_its_links(): void
    {
        $bowl = $this->pick('bowl', 'Bowl');
        $post = $this->makePost('guide');
        $post->products()->attach($bowl->id);

        $post->delete();

        $this->assertDatabaseMissing('post_product', ['lunar_product_id' => $bowl->id]);
    }

    // ---- admin: the Pick side, read-only -----------------------------------------------------------------------

    public function test_the_admin_pick_lists_only_published_posts_in_mentioned_in(): void
    {
        $bowl = $this->pick('bowl', 'Bowl');
        $live = $this->makePost('live-guide');
        $draft = $this->makePost('draft-guide', 'draft', null);
        $live->products()->attach($bowl->id);
        $draft->products()->attach($bowl->id);

        $mentioned = $this->getJson("/api/admin/products/{$bowl->id}")->assertOk()->json('data.mentioned_in');

        $this->assertSame([$live->id], array_column($mentioned, 'id'));
        $this->assertSame('Post live-guide', $mentioned[0]['title']);
    }
}
