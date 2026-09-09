<?php

namespace Tests\Unit\Services;

use App\Services\StorefrontOriginFreshnessService;
use App\Services\StorefrontProjection;
use PHPUnit\Framework\TestCase;
use Tests\Fixtures\StorefrontHtml;

class StorefrontCanonicalRootTest extends TestCase
{
    public function test_installed_next_canonical_root_without_slash_is_equivalent(): void
    {
        // Saved C4 B HTTP HTML emits this exact no-slash canonical href.
        $html = str_replace('rel="canonical" href="https://petposture.com/"', 'rel="canonical" href="https://petposture.com"', StorefrontHtml::render());
        $expected = StorefrontProjection::fromPublicData(StorefrontHtml::settings(), []);
        $this->assertTrue((new StorefrontOriginFreshnessService)->matches($html, $expected));
    }

    public function test_canonical_equivalence_does_not_admit_other_authorities_paths_or_queries(): void
    {
        $expected = StorefrontProjection::fromPublicData(StorefrontHtml::settings(), []);
        foreach (['https://other.example/', 'https://petposture.com/other', 'https://petposture.com/?x=1', 'http://petposture.com/', 'https://petposture.com/#fragment'] as $url) {
            $html = str_replace('rel="canonical" href="https://petposture.com/"', 'rel="canonical" href="'.$url.'"', StorefrontHtml::render());
            $this->assertFalse((new StorefrontOriginFreshnessService)->matches($html, $expected));
        }
    }
}
