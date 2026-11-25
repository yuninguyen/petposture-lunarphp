<?php

namespace Tests\Unit\Services;

use App\Services\StorefrontProjection;
use PHPUnit\Framework\TestCase;

/**
 * The automatic Cloudflare purge only runs when the homepage matches StorefrontProjection. The homepage's own metadata
 * lives in the storefront, so this reads it from there: changing one side without the other must fail here, not
 * silently stop the purge in production.
 */
class StorefrontHomepageContractTest extends TestCase
{
    private function homepageSource(): string
    {
        $source = file_get_contents(__DIR__.'/../../../../frontend/app/page.tsx');
        $this->assertIsString($source);

        return $source;
    }

    private function capture(string $pattern): string
    {
        $this->assertSame(1, preg_match($pattern, $this->homepageSource(), $match), 'Not found in frontend/app/page.tsx: '.$pattern);

        return $match[1];
    }

    public function test_expected_homepage_metadata_is_the_metadata_the_storefront_homepage_declares(): void
    {
        $title = $this->capture("~const HOME_TITLE =\s*'([^'\\\\]+)';~");
        $description = $this->capture("~const HOME_DESCRIPTION =\s*'([^'\\\\]+)';~");
        $siteName = $this->capture("~siteName: '([^'\\\\]+)'~");
        $image = $this->capture("~const HOME_SOCIAL_IMAGE = \{\s*url: '([^'\\\\]+)'~");
        $width = $this->capture('~const HOME_SOCIAL_IMAGE = \{[^}]*width: (\d+)~');
        $height = $this->capture('~const HOME_SOCIAL_IMAGE = \{[^}]*height: (\d+)~');
        $alt = $this->capture("~const HOME_SOCIAL_IMAGE = \{[^}]*alt: '([^'\\\\]+)'~");
        $type = $this->capture("~openGraph: \{[^}]*type: '([^'\\\\]+)'~");
        $card = $this->capture("~twitter: \{[^}]*card: '([^'\\\\]+)'~");

        // Settings that differ from the homepage's own words: they must not leak into the expected page metadata.
        $expected = StorefrontProjection::fromPublicData([
            'shop_name' => 'Renamed Shop', 'shop_logo' => null, 'description' => 'Global description from the admin',
            'social' => [], 'contact' => [],
        ], []);

        $this->assertSame([
            'title' => $title, 'description' => $description,
            'og:site_name' => $siteName, 'og:type' => $type, 'og:url' => 'https://petposture.com',
            'og:title' => $title, 'og:description' => $description, 'og:image' => 'https://petposture.com'.$image,
            'og:image:width' => $width, 'og:image:height' => $height, 'og:image:alt' => $alt,
            'twitter:card' => $card, 'twitter:title' => $title,
            'twitter:description' => $description, 'twitter:image' => 'https://petposture.com'.$image,
        ], $expected['metadata']);

        // The structured data still follows the admin settings, so a stale homepage is still caught.
        $this->assertSame('Renamed Shop', $expected['organization']['name']);
        $this->assertSame('Global description from the admin', $expected['organization']['description']);
        $this->assertSame('Renamed Shop', $expected['website']['name']);
    }
}
