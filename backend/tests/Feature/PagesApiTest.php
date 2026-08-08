<?php

namespace Tests\Feature;

use App\Models\Page;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PagesApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_active_page_is_returned_by_slug(): void
    {
        Page::create([
            'slug' => 'privacy-policy',
            'title' => 'Privacy Policy',
            'content' => '<p>Test content</p>',
            'meta_title' => 'Privacy Policy',
            'meta_description' => 'Test description',
            'is_active' => true,
            'is_core' => true,
        ]);

        $response = $this->getJson('/api/pages/privacy-policy');

        $response->assertOk()
            ->assertJsonPath('data.slug', 'privacy-policy')
            ->assertJsonPath('data.title', 'Privacy Policy')
            ->assertJsonPath('data.content', '<p>Test content</p>');
    }

    public function test_inactive_page_returns_404(): void
    {
        Page::create([
            'slug' => 'draft-page',
            'title' => 'Draft Page',
            'content' => '<p>Hidden</p>',
            'is_active' => false,
            'is_core' => false,
        ]);

        $this->getJson('/api/pages/draft-page')->assertNotFound();
    }

    public function test_unknown_slug_returns_404(): void
    {
        $this->getJson('/api/pages/does-not-exist')->assertNotFound();
    }
}
