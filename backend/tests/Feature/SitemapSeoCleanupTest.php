<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SitemapSeoCleanupTest extends TestCase
{
    use RefreshDatabase;

    public function test_sitemap_redirects_to_frontend_sitemap(): void
    {
        config(['app.frontend_url' => 'https://www.example.test']);

        $this->get('/sitemap.xml')
            ->assertStatus(301)
            ->assertRedirect('https://www.example.test/sitemap.xml');
    }

    public function test_legacy_seo_endpoint_is_removed(): void
    {
        $this->getJson('/api/seo?path=/shop/example-product')
            ->assertNotFound();
    }
}
