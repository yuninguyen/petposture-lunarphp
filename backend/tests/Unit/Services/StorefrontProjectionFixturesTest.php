<?php

namespace Tests\Unit\Services;

use App\Services\StorefrontOriginFreshnessService;
use App\Services\StorefrontProjection;
use PHPUnit\Framework\TestCase;
use Tests\Fixtures\StorefrontHtml;

class StorefrontProjectionFixturesTest extends TestCase
{
    public function test_optimizer_decodes_query_once_and_compares_every_candidate(): void
    {
        $source = 'https://api.petposture.com/storage/a%2Fb%26c%25d%2Be.webp?x=one+two&y=%26';
        $expected = StorefrontProjection::fromPublicData(StorefrontHtml::settings(), [['title' => 'hero', 'url' => $source]]);
        $optimized = '/_next/image?url='.rawurlencode($source).'&w=1920&q=75';
        $parser = new StorefrontOriginFreshnessService;
        $this->assertTrue($parser->matches(StorefrontHtml::render('B', $optimized), $expected));
        $this->assertFalse($parser->matches(StorefrontHtml::render('B', '/_next/image?url='.rawurlencode(urldecode($source)).'&w=1920&q=75'), $expected));
        $this->assertFalse($parser->matches(StorefrontHtml::render('B', 'https://other.example'.$optimized), $expected));
        $this->assertFalse($parser->matches(StorefrontHtml::render('B', $optimized.'&url='.rawurlencode($source)), $expected));
    }

    public function test_direct_svg_and_html_entities_are_not_double_decoded(): void
    {
        $source = 'https://api.petposture.com/storage/logo.svg?a=1&amp;b=2';
        $expected = StorefrontProjection::fromPublicData(StorefrontHtml::settings('B &amp;'), [['title' => 'hero', 'url' => $source]]);
        $this->assertTrue((new StorefrontOriginFreshnessService)->matches(StorefrontHtml::render('B &amp;', $source), $expected));
        $this->assertFalse((new StorefrontOriginFreshnessService)->matches(StorefrontHtml::render('B &amp;', str_replace('&amp;', '&', $source)), $expected));
    }

    public function test_social_order_duplicates_logo_phone_address_and_json_escaping_match_exactly(): void
    {
        $settings = StorefrontHtml::settings();
        $settings['shop_logo'] = 'https://api.petposture.com/logo.svg';
        $settings['social'] = ['facebook' => ' f ', 'instagram' => 'i', 'twitter' => ' f '];
        $settings['contact'] = ['phone' => '0', 'address' => "x &amp; < y\u{2028}\u{2029}"];
        $expected = StorefrontProjection::fromPublicData($settings, []);
        $extra = ',"logo":"https://api.petposture.com/logo.svg","sameAs":[" f ","i"," f "],"telephone":"0","address":{"@type":"PostalAddress","streetAddress":"x &amp; \\u003c y\\u2028\\u2029"}';
        $html = str_replace('"description":"Committed description"}', '"description":"Committed description"'.$extra.'}', StorefrontHtml::render());
        $parser = new StorefrontOriginFreshnessService;
        $this->assertTrue($parser->matches($html, $expected));
        $this->assertFalse($parser->matches(str_replace('[" f ","i"," f "]', '["i"," f "," f "]', $html), $expected));
        $this->assertFalse($parser->matches(str_replace('"telephone":"0"', '"telephone":"old"', $html), $expected));
    }

    public function test_fallback_unequal_expected_and_duplicate_owned_entities_fail(): void
    {
        $expected = StorefrontProjection::fromPublicData(StorefrontHtml::settings(), []);
        $parser = new StorefrontOriginFreshnessService;
        $this->assertFalse($parser->matches(StorefrontHtml::render('PetPosture'), $expected));
        $html = str_replace('</head>', '<meta name="description" content="Committed description"></head>', StorefrontHtml::render());
        $this->assertFalse($parser->matches($html, $expected));
        $html = str_replace('</body>', '<script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@id":"https://petposture.com/#website"}]}</script></body>', StorefrontHtml::render());
        $this->assertFalse($parser->matches($html, $expected));
    }
}
