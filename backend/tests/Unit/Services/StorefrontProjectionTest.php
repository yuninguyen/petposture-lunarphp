<?php

namespace Tests\Unit\Services;

use App\Services\StorefrontProjection;
use InvalidArgumentException;
use PHPUnit\Framework\TestCase;

class StorefrontProjectionTest extends TestCase
{
    public function test_string_zero_and_untrimmed_social_values_follow_javascript_defaults(): void
    {
        $projection = StorefrontProjection::fromPublicData([
            'shop_name' => '0', 'shop_logo' => null, 'description' => '',
            'social' => ['facebook' => "\u{00a0}", 'instagram' => ' x ', 'twitter' => ' x '],
            'contact' => ['phone' => '0', 'address' => ' '],
        ], [['title' => 'hero', 'url' => ''], ['title' => 'hero', 'url' => '/later.webp']]);
        $this->assertSame('0', $projection['organization']['name']);
        $this->assertSame([' x ', ' x '], $projection['organization']['sameAs']);
        $this->assertSame('0', $projection['organization']['telephone']);
        $this->assertSame(' ', $projection['organization']['address']['streetAddress']);
        $this->assertSame('Breed-focused pet product recommendations based on practical fit, materials, usability and everyday comfort.', $projection['organization']['description']);
        $this->assertSame('/assets/banner/hero-banner-homepage.webp', $projection['hero']);
    }

    public function test_legitimate_null_defaults_and_no_hero_are_supported(): void
    {
        $projection = StorefrontProjection::fromPublicData([
            'shop_name' => null, 'shop_logo' => null, 'description' => null,
            'social' => null, 'contact' => null,
        ], []);
        $this->assertSame('PetPosture', $projection['website']['name']);
        $this->assertArrayNotHasKey('logo', $projection['organization']);
        $this->assertArrayNotHasKey('sameAs', $projection['organization']);
        $this->assertSame('PetPosture — Breed-Focused Pet Product Recommendations', $projection['metadata']['title']);
    }

    public function test_malformed_independent_projection_cannot_become_legitimate_defaults(): void
    {
        $this->expectException(InvalidArgumentException::class);
        StorefrontProjection::fromPublicData(['shop_name' => ['bad']], []);
    }
}
