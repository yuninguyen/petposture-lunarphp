<?php

namespace Tests\Unit\Services;

use App\Services\StorefrontOriginFreshnessService;
use App\Services\StorefrontProjection;
use PHPUnit\Framework\TestCase;

class StorefrontOriginFreshnessServiceTest extends TestCase
{
    private function expected(): array
    {
        return StorefrontProjection::fromPublicData(['shop_name' => 'B & <shop>', 'shop_logo' => null,
            'description' => 'Committed description', 'social' => [], 'contact' => []], []);
    }

    private function html(): string
    {
        return '<!DOCTYPE html><html><head><title>B &amp; &lt;shop&gt; — Breed-Focused Pet Product Recommendations</title>'
            .'<meta name="description" content="Committed description">'
            .'<meta property="og:site_name" content="B &amp; &lt;shop&gt;"><meta property="og:type" content="website">'
            .'<meta property="og:url" content="https://petposture.com"><meta property="og:title" content="B &amp; &lt;shop&gt; — Breed-Focused Pet Product Recommendations">'
            .'<meta property="og:description" content="Committed description"><meta property="og:image" content="https://petposture.com/assets/banner/social-preview.webp">'
            .'<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:image:alt" content="B &amp; &lt;shop&gt; pet products">'
            .'<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="B &amp; &lt;shop&gt; — Breed-Focused Pet Product Recommendations">'
            .'<meta name="twitter:description" content="Committed description"><meta name="twitter:image" content="https://petposture.com/assets/banner/social-preview.webp">'
            .'<link rel="canonical" href="https://petposture.com/"></head><body>'
            .'<script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"Organization","@id":"https://petposture.com/#organization","name":"B & \\u003cshop>","url":"https://petposture.com","description":"Committed description"},{"@type":"WebSite","@id":"https://petposture.com/#website","name":"B & \\u003cshop>","url":"https://petposture.com"}]}</script>'
            .'<img alt="Comfortable feeding setup" src="/_next/image?url=%2Fassets%2Fbanner%2Fhero-banner-homepage.webp&amp;w=1920&amp;q=75" srcset="/_next/image?url=%2Fassets%2Fbanner%2Fhero-banner-homepage.webp&amp;w=640&amp;q=75 640w, /_next/image?url=%2Fassets%2Fbanner%2Fhero-banner-homepage.webp&amp;w=1920&amp;q=75 1920w">'
            .'</body></html>';
    }

    public function test_exact_existing_metadata_schema_and_actual_hero_match(): void
    {
        $this->assertTrue((new StorefrontOriginFreshnessService)->matches($this->html(), $this->expected()));
    }

    public function test_stale_layout_cannot_hide_behind_fresh_schema(): void
    {
        $html = str_replace('<title>B &amp; &lt;shop&gt;', '<title>A', $this->html());
        $this->assertFalse((new StorefrontOriginFreshnessService)->matches($html, $this->expected()));
    }

    public function test_changed_non_name_schema_field_is_rejected(): void
    {
        $html = str_replace('"description":"Committed description"', '"description":"old"', $this->html());
        $this->assertFalse((new StorefrontOriginFreshnessService)->matches($html, $this->expected()));
    }

    public function test_ambiguous_hero_inconsistent_srcset_nonce_and_truncation_fail_closed(): void
    {
        foreach ([str_replace('</body>', '<img alt="Comfortable feeding setup" src="/old.webp"></body>', $this->html()),
            str_replace('w=640&amp;q=75', 'url=%2Fold.webp&amp;w=640&amp;q=75', $this->html()),
            str_replace('<script ', '<script nonce="bad" ', $this->html()),
            str_replace('</html>', '', $this->html())] as $html) {
            $this->assertFalse((new StorefrontOriginFreshnessService)->matches($html, $this->expected()));
        }
    }
}
