<?php
namespace Tests\Unit\Services;

use App\Services\StorefrontOriginFreshnessService;
use App\Services\StorefrontProjection;
use PHPUnit\Framework\TestCase;
use Tests\Fixtures\StorefrontHtml;

class StorefrontAmbiguityTest extends TestCase
{
    public function test_duplicate_members_in_both_orders_and_escaped_equivalent_names_fail(): void
    {
        $expected = StorefrontProjection::fromPublicData(StorefrontHtml::settings(), []);
        foreach (['"name":"old","name":"B"', '"name":"B","name":"old"', '"na\\u006de":"old","name":"B"'] as $replacement) {
            $html = str_replace('"name":"B"', $replacement, StorefrontHtml::render());
            $this->assertFalse((new StorefrontOriginFreshnessService)->matches($html, $expected));
        }
        foreach (['"@id":"old","@id":"https:\/\/petposture.com\/#organization"', '"@id":"https:\/\/petposture.com\/#organization","@id":"old"'] as $replacement) {
            $html = str_replace('"@id":"https:\/\/petposture.com\/#organization"', $replacement, StorefrontHtml::render());
            $this->assertFalse((new StorefrontOriginFreshnessService)->matches($html, $expected));
        }
    }

    public function test_nested_duplicate_address_fails_but_unique_reordered_members_pass(): void
    {
        $settings = StorefrontHtml::settings();
        $settings['contact'] = ['address' => 'new'];
        $expected = StorefrontProjection::fromPublicData($settings, []);
        $html = str_replace('"description":"Committed description"}', '"address":{"streetAddress":"new","@type":"PostalAddress"},"description":"Committed description"}', StorefrontHtml::render());
        $parser = new StorefrontOriginFreshnessService;
        $this->assertTrue($parser->matches($html, $expected));
        foreach (['"streetAddress":"old","streetAddress":"new"', '"streetAddress":"new","streetAddress":"old"'] as $replacement) {
            $this->assertFalse($parser->matches(str_replace('"streetAddress":"new"', $replacement, $html), $expected));
        }
    }

    public function test_valid_single_url_srcset_candidate_with_old_source_fails(): void
    {
        $html = str_replace('<img alt=', '<img srcset="/_next/image?url=%2Fold.webp&amp;w=640&amp;q=75 640w, /_next/image?url=%2Fassets%2Fbanner%2Fhero-banner-homepage.webp&amp;w=1920&amp;q=75 1920w" alt=', StorefrontHtml::render());
        $this->assertFalse((new StorefrontOriginFreshnessService)->matches($html, StorefrontProjection::fromPublicData(StorefrontHtml::settings(), [])));
    }

    public function test_complete_settings_with_invalid_projected_scalar_fail(): void
    {
        foreach (['shop_name', 'description', 'shop_logo'] as $key) {
            $settings = StorefrontHtml::settings();
            $settings[$key] = ['bad'];
            try {
                StorefrontProjection::fromPublicData($settings, []);
                $this->fail('Object must not coerce into a public string.');
            } catch (\InvalidArgumentException) {
                $this->addToAssertionCount(1);
            }
        }
    }
}
