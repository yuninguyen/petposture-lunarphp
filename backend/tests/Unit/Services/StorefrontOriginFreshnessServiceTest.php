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
        $title = 'PetPosture | Dog Product Picks by Breed &amp; Body Type';
        $description = 'Dog product picks matched to breed and body type. Ramp guides for Dachshunds, harness and feeding guides for French Bulldogs. Browse by breed or need.';

        return '<!DOCTYPE html><html><head><title>'.$title.'</title>'
            .'<meta name="description" content="'.$description.'">'
            .'<meta property="og:site_name" content="PetPosture"><meta property="og:type" content="website">'
            .'<meta property="og:url" content="https://petposture.com"><meta property="og:title" content="'.$title.'">'
            .'<meta property="og:description" content="'.$description.'"><meta property="og:image" content="https://petposture.com/assets/banner/social-preview.webp">'
            .'<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:image:alt" content="PetPosture pet products">'
            .'<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="'.$title.'">'
            .'<meta name="twitter:description" content="'.$description.'"><meta name="twitter:image" content="https://petposture.com/assets/banner/social-preview.webp">'
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
        $html = str_replace('<title>PetPosture', '<title>Old', $this->html());
        $this->assertNotSame($this->html(), $html);
        $this->assertFalse((new StorefrontOriginFreshnessService)->matches($html, $this->expected()));
    }

    public function test_every_differing_field_is_named_so_the_log_can_say_why_the_purge_stopped(): void
    {
        $parser = new StorefrontOriginFreshnessService;
        $this->assertSame([], $parser->mismatches($this->html(), $this->expected()));

        $html = str_replace(
            ['<title>PetPosture', 'content="1200"', '"description":"Committed description"', 'hero-banner-homepage.webp'],
            ['<title>Old', 'content="800"', '"description":"old"', 'old.webp'],
            $this->html(),
        );
        $this->assertSame(
            ['title', 'og:image:width', 'json-ld:organization', 'hero-image'],
            $parser->mismatches($html, $this->expected()),
        );
        $this->assertSame(['document'], $parser->mismatches(str_replace('</html>', '', $this->html()), $this->expected()));
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
