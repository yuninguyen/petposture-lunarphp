<?php

namespace Tests\Unit\Services;

use App\Services\StorefrontOriginFreshnessService;
use App\Services\StorefrontProjection;
use PHPUnit\Framework\TestCase;

class StorefrontCapturedNextTest extends TestCase
{
    public function test_captured_b_matches_independent_expected_b_and_retained_a_does_not(): void
    {
        // Literal data from separate successful C4 expected-B-settings/media HTTP reads,
        // not reconstructed from rendered HTML or production schema helpers.
        $expected = StorefrontProjection::fromPublicData([
            'shop_name' => 'C4 Local B', 'shop_logo' => null,
            'description' => 'Local runtime description B with practical pet comfort.',
            'social' => [], 'contact' => [],
        ], [['title' => 'hero', 'url' => 'https://petposture.com/assets/banner/c4-hero-B.webp']]);
        $parser = new StorefrontOriginFreshnessService;
        $a = file_get_contents(__DIR__.'/../../Fixtures/captured-next-A.html');
        $b = file_get_contents(__DIR__.'/../../Fixtures/captured-next-B.html');
        $this->assertLessThan(4096, strlen($a));
        $this->assertLessThan(4096, strlen($b));
        $this->assertTrue($parser->matches($b, $expected));
        $this->assertFalse($parser->matches($a, $expected));
        foreach (['https://petposture.com:443', 'https://petposture.com/?x=1', 'https://petposture.com/other', 'http://petposture.com', 'https://other.example'] as $url) {
            $this->assertFalse($parser->matches(str_replace('rel="canonical" href="https://petposture.com"', 'rel="canonical" href="'.$url.'"', $b), $expected));
        }
        // Canonical-link equivalence must not relax JSON-LD's exact URL contract.
        $this->assertFalse($parser->matches(str_replace('"url":"https://petposture.com"', '"url":"https://petposture.com/"', $b), $expected));
    }
}
