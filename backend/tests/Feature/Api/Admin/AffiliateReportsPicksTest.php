<?php

namespace Tests\Feature\Api\Admin;

use App\Models\AffiliateClick;
use App\Models\AffiliateNetwork;
use App\Models\BlogCategory;
use App\Models\Post;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Lunar\Models\Product;
use Lunar\Models\ProductType;
use Tests\TestCase;

class AffiliateReportsPicksTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(RoleSeeder::class);
        $admin = User::factory()->create(['is_active' => true]);
        $admin->assignRole('admin');
        Sanctum::actingAs($admin);
    }

    private function blogPost(): Post
    {
        $category = BlogCategory::query()->firstOrCreate(['slug' => 'guides'], ['name' => 'Guides']);

        return Post::create([
            'title' => 'Top Dog Harnesses',
            'slug' => 'top-dog-harnesses',
            'content' => 'Content',
            'blog_category_id' => $category->id,
            'status' => 'draft',
        ]);
    }

    private function product(): Product
    {
        $type = ProductType::query()->firstOrCreate(['name' => 'Pets']);

        return Product::query()->create(['product_type_id' => $type->id, 'status' => 'published', 'attribute_data' => []]);
    }

    private function network(): AffiliateNetwork
    {
        return AffiliateNetwork::query()->firstOrCreate(['slug' => 'chewy'], ['name' => 'Chewy', 'active' => true]);
    }

    private function click(array $attributes): void
    {
        // created_at is not fillable, so set it directly to place the click in time.
        (new AffiliateClick)
            ->forceFill($attributes + ['target_url' => 'https://example.com/x', 'created_at' => now()->subDay()])
            ->save();
    }

    public function test_pick_clicks_are_counted_in_the_totals_and_by_network(): void
    {
        $network = $this->network();
        $product = $this->product();
        $this->click(['post_id' => $this->blogPost()->id, 'affiliate_network_id' => $network->id]);
        $this->click(['product_id' => $product->id, 'product_name' => 'Necoichi bowl', 'affiliate_network_id' => $network->id]);

        $response = $this->getJson('/api/admin/affiliate/reports?range=30')->assertOk();

        $response->assertJsonPath('overview.clicks_30d', 2);
        $response->assertJsonPath('by_network.0.clicks', 2);
    }

    public function test_pick_clicks_do_not_show_up_as_a_deleted_post(): void
    {
        $product = $this->product();
        $post = $this->blogPost();
        $this->click(['post_id' => $post->id]);
        $this->click(['product_id' => $product->id, 'product_name' => 'Necoichi bowl']);

        $byPost = $this->getJson('/api/admin/affiliate/reports?range=30')->assertOk()->json('by_post');

        $this->assertCount(1, $byPost);
        $this->assertSame($post->id, $byPost[0]['post_id']);
        $this->assertSame('Top Dog Harnesses', $byPost[0]['post_title']);
    }

    public function test_top_clicked_picks_are_listed_by_product(): void
    {
        $bowl = $this->product();
        $harness = $this->product();
        foreach (range(1, 3) as $ignored) {
            $this->click(['product_id' => $bowl->id, 'product_name' => 'Necoichi bowl']);
        }
        $this->click(['product_id' => $harness->id, 'product_name' => 'Soft harness']);
        $this->click(['post_id' => $this->blogPost()->id]);

        $byProduct = $this->getJson('/api/admin/affiliate/reports?range=30')->assertOk()->json('by_product');

        $this->assertSame(
            [
                ['product_id' => $bowl->id, 'product_name' => 'Necoichi bowl', 'clicks' => 3],
                ['product_id' => $harness->id, 'product_name' => 'Soft harness', 'clicks' => 1],
            ],
            $byProduct,
        );
    }

    public function test_by_product_is_empty_when_no_pick_was_clicked(): void
    {
        $this->click(['post_id' => $this->blogPost()->id]);

        $this->getJson('/api/admin/affiliate/reports?range=30')->assertOk()->assertJsonPath('by_product', []);
    }

    public function test_by_product_respects_the_date_range(): void
    {
        $product = $this->product();
        $this->click(['product_id' => $product->id, 'product_name' => 'Necoichi bowl', 'created_at' => now()->subDays(60)]);

        $this->getJson('/api/admin/affiliate/reports?range=30')->assertOk()->assertJsonPath('by_product', []);
        $this->getJson('/api/admin/affiliate/reports?range=all')->assertOk()->assertJsonPath('by_product.0.clicks', 1);
    }
}
