<?php

namespace Tests\Feature;

use App\Filament\Pages\AffiliateReports;
use App\Filament\Resources\BlogTagResource\Pages\CreateBlogTag;
use App\Filament\Resources\BlogTagResource\Pages\EditBlogTag;
use App\Filament\Resources\BlogTagResource\Pages\ListBlogTags;
use App\Filament\Resources\PageResource\Pages\CreatePage;
use App\Filament\Resources\PageResource\Pages\EditPage;
use App\Filament\Resources\PageResource\Pages\ListPages;
use App\Filament\Resources\PostResource\Pages\CreatePost;
use App\Filament\Resources\PostResource\Pages\EditPost;
use App\Filament\Resources\PostResource\Pages\ListPosts;
use App\Models\AffiliateClick;
use App\Models\AffiliateNetwork;
use App\Models\BlogCategory;
use App\Models\BlogTag;
use App\Models\Page;
use App\Models\Post;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Livewire\Livewire;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class ContentAdminRendersTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        Role::firstOrCreate(['name' => 'super_admin', 'guard_name' => 'web']);
        $user = User::factory()->create();
        $user->assignRole('super_admin');
        $this->actingAs($user);
    }

    public function test_posts_list_renders_with_new_columns_and_out_of_stock_badge(): void
    {
        $category = BlogCategory::create(['name' => 'Test Category', 'slug' => 'test-category']);

        $post = Post::create([
            'blog_category_id' => $category->id,
            'type' => Post::TYPE_COMPARISON,
            'title' => 'Out of Stock Test Post',
            'slug' => 'out-of-stock-test-post',
            'content' => '<p>content</p>',
            'author' => 'Test Author',
            'status' => 'published',
            'published_at' => now(),
        ]);
        $post->setMeta('comparison_items', [
            ['product_name' => 'Widget', 'in_stock' => false],
        ], 'json');

        Livewire::test(ListPosts::class)
            ->assertSuccessful()
            ->assertSeeHtml('Out of stock');
    }

    public function test_post_create_and_edit_forms_render_with_tags_and_in_stock_toggle(): void
    {
        BlogCategory::create(['name' => 'Test Category', 'slug' => 'test-category']);

        Livewire::test(CreatePost::class)->assertSuccessful();

        $post = Post::create([
            'blog_category_id' => BlogCategory::first()->id,
            'type' => Post::TYPE_ARTICLE,
            'title' => 'Editable Post',
            'slug' => 'editable-post',
            'content' => '<p>content</p>',
            'status' => 'draft',
        ]);

        Livewire::test(EditPost::class, ['record' => $post->getRouteKey()])
            ->assertSuccessful();
    }

    public function test_filament_post_preview_uses_native_route_signature(): void
    {
        config()->set('app.frontend_url', 'https://storefront.example.test');
        $category = BlogCategory::create(['name' => 'Preview Category', 'slug' => 'preview-category']);
        $post = Post::create([
            'blog_category_id' => $category->id,
            'type' => Post::TYPE_ARTICLE,
            'title' => 'Filament Preview',
            'slug' => 'filament-preview',
            'content' => '<p>content</p>',
            'status' => 'draft',
        ]);
        $component = Livewire::test(EditPost::class, ['record' => $post->getRouteKey()])->instance();
        $url = (fn (): string => $this->getPreviewUrl())->call($component);
        $parts = parse_url($url);
        parse_str($parts['query'] ?? '', $query);

        $this->assertSame('/blog/filament-preview', $parts['path'] ?? null);
        $this->assertNotEmpty($query['signature'] ?? null);
        $this->assertArrayNotHasKey('preview_token', $query);
    }

    public function test_blog_tag_pages_render(): void
    {
        $tag = BlogTag::create(['name' => 'Ergonomics', 'slug' => 'ergonomics']);

        Livewire::test(ListBlogTags::class)->assertSuccessful();
        Livewire::test(CreateBlogTag::class)->assertSuccessful();
        Livewire::test(EditBlogTag::class, ['record' => $tag->getRouteKey()])->assertSuccessful();
    }

    public function test_merging_blog_tags_moves_posts_and_deletes_source(): void
    {
        $category = BlogCategory::create(['name' => 'Test Category', 'slug' => 'test-category']);
        $post = Post::create([
            'blog_category_id' => $category->id,
            'type' => Post::TYPE_ARTICLE,
            'title' => 'Tagged Post',
            'slug' => 'tagged-post',
            'content' => '<p>content</p>',
            'status' => 'draft',
        ]);

        $source = BlogTag::create(['name' => 'reactjs', 'slug' => 'reactjs']);
        $target = BlogTag::create(['name' => 'React', 'slug' => 'react']);
        $post->tags()->attach($source->id);

        Livewire::test(ListBlogTags::class)
            ->callTableAction('merge', $source, data: ['target_tag_id' => $target->id])
            ->assertSuccessful();

        $this->assertDatabaseMissing('blog_tags', ['id' => $source->id]);
        $this->assertTrue($post->fresh()->tags->pluck('id')->contains($target->id));
    }

    public function test_affiliate_reports_page_renders_with_click_data(): void
    {
        $category = BlogCategory::create(['name' => 'Test Category', 'slug' => 'test-category']);
        $post = Post::create([
            'blog_category_id' => $category->id,
            'type' => Post::TYPE_COMPARISON,
            'title' => 'Reports Test Post',
            'slug' => 'reports-test-post',
            'content' => '<p>content</p>',
            'status' => 'published',
            'published_at' => now(),
        ]);
        $network = AffiliateNetwork::firstOrCreate(['slug' => 'chewy'], ['name' => 'Chewy', 'active' => true]);

        AffiliateClick::create([
            'post_id' => $post->id,
            'affiliate_network_id' => $network->id,
            'product_name' => 'Widget',
            'target_url' => 'https://example.com/widget',
        ]);

        Livewire::test(AffiliateReports::class)
            ->assertSuccessful()
            ->assertSeeHtml('Reports Test Post')
            ->assertSeeHtml('Chewy');
    }

    public function test_page_resource_pages_render(): void
    {
        $page = Page::create([
            'slug' => 'privacy-policy',
            'title' => 'Privacy Policy',
            'content' => '<p>Test content</p>',
            'is_active' => true,
            'is_core' => true,
        ]);

        Livewire::test(ListPages::class)->assertSuccessful()->assertSeeHtml('Privacy Policy');
        Livewire::test(CreatePage::class)->assertSuccessful();
        Livewire::test(EditPage::class, ['record' => $page->getRouteKey()])->assertSuccessful();
    }

    public function test_core_page_cannot_be_deleted_but_custom_page_can(): void
    {
        $corePage = Page::create([
            'slug' => 'privacy-policy',
            'title' => 'Privacy Policy',
            'content' => '<p>Test</p>',
            'is_active' => true,
            'is_core' => true,
        ]);
        $customPage = Page::create([
            'slug' => 'about-us',
            'title' => 'About Us',
            'content' => '<p>Test</p>',
            'is_active' => true,
            'is_core' => false,
        ]);

        Livewire::test(ListPages::class)
            ->callTableAction('delete', $customPage)
            ->assertSuccessful();

        $this->assertDatabaseMissing('pages', ['id' => $customPage->id]);
        $this->assertDatabaseHas('pages', ['id' => $corePage->id]);
    }

    public function test_edit_post_header_update_and_publish_action_saves(): void
    {
        $category = BlogCategory::create(['name' => 'Test Category', 'slug' => 'test-category']);
        $post = Post::create([
            'blog_category_id' => $category->id,
            'type' => Post::TYPE_ARTICLE,
            'title' => 'Editable Post',
            'slug' => 'editable-post',
            'content' => '<p>content</p>',
            'status' => 'draft',
        ]);

        Livewire::test(EditPost::class, ['record' => $post->getRouteKey()])
            ->fillForm([
                'title' => 'Updated From Header',
                'slug' => 'editable-post',
                'content' => '<p>updated content</p>',
                'blog_category_id' => $category->id,
                'type' => Post::TYPE_ARTICLE,
                'status' => 'published',
            ])
            ->call('mountAction', 'headerSave')
            ->assertSuccessful();

        $this->assertDatabaseHas('posts', [
            'id' => $post->id,
            'title' => 'Updated From Header',
            'status' => 'published',
        ]);
        $this->assertNotNull($post->fresh()->published_at);
    }

    public function test_create_post_header_save_action_creates_post(): void
    {
        $category = BlogCategory::create(['name' => 'Test Category', 'slug' => 'test-category']);

        Livewire::test(CreatePost::class)
            ->fillForm([
                'title' => 'Created From Header',
                'slug' => 'created-from-header',
                'content' => '<p>content</p>',
                'blog_category_id' => $category->id,
                'type' => Post::TYPE_ARTICLE,
                'author' => 'Test Author',
                'status' => 'published',
            ])
            ->call('mountAction', 'save')
            ->assertSuccessful();

        $this->assertDatabaseHas('posts', [
            'title' => 'Created From Header',
            'status' => 'published',
        ]);
    }
}
