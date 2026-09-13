<?php

namespace Tests\Feature;

use App\Models\Page;
use App\Models\Post;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class RichTextSanitizationTest extends TestCase
{
    use RefreshDatabase;

    private const XSS_HTML = '<p>Safe <strong>content</strong><img src="/pet.jpg" onerror="alert(1)"><a href="javascript:alert(2)">click</a></p><script>alert(3)</script><iframe src="https://evil.example/embed"></iframe>';

    public function test_blog_content_is_sanitized_before_persistence(): void
    {
        $post = Post::query()->create([
            'title' => 'Security post',
            'slug' => 'security-post',
            'content' => self::XSS_HTML,
            'type' => Post::TYPE_ARTICLE,
            'status' => 'draft',
        ]);

        $this->assertSanitized((string) $post->fresh()->content);
    }

    public function test_legal_page_content_is_sanitized_before_persistence(): void
    {
        $page = Page::query()->create([
            'title' => 'Security page',
            'slug' => 'security-page',
            'content' => self::XSS_HTML,
            'status' => 'draft',
            'is_active' => true,
        ]);

        $this->assertSanitized((string) $page->fresh()->content);
    }

    private function assertSanitized(string $html): void
    {
        $this->assertStringContainsString('<strong>content</strong>', $html);
        $this->assertStringNotContainsString('<script', $html);
        $this->assertStringNotContainsString('onerror', $html);
        $this->assertStringNotContainsString('javascript:', $html);
        $this->assertStringNotContainsString('<iframe', $html);
    }

    public function test_cta_button_class_and_style_survive_persistence(): void
    {
        $html = '<p><a class="pp-cta-primary" href="/dogs" style="background:#df8448;padding:14px 32px;">Explore Breeds</a></p>';

        $post = Post::query()->create([
            'title' => 'CTA post',
            'slug' => 'cta-post',
            'content' => $html,
            'type' => Post::TYPE_ARTICLE,
            'status' => 'draft',
        ]);

        $persisted = (string) $post->fresh()->content;
        $this->assertStringContainsString('class="pp-cta-primary"', $persisted);
        $this->assertStringContainsString('style="background:#df8448;padding:14px 32px;"', $persisted);
    }

    public function test_table_column_width_metadata_survives_persistence(): void
    {
        $html = '<table width="100%"><colgroup><col style="width:180px"></colgroup><tbody><tr><th colwidth="180">Head</th></tr><tr><td colwidth="180">Cell</td></tr></tbody></table>';

        $post = Post::query()->create([
            'title' => 'Table post',
            'slug' => 'table-post',
            'content' => $html,
            'type' => Post::TYPE_ARTICLE,
            'status' => 'draft',
        ]);

        $persisted = (string) $post->fresh()->content;
        $this->assertStringContainsString('<colgroup>', $persisted);
        $this->assertStringContainsString('colwidth="180"', $persisted);
        $this->assertStringContainsString('width="100%"', $persisted);
    }
}
