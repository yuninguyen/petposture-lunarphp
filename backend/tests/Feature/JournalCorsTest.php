<?php

namespace Tests\Feature;

use Tests\TestCase;

class JournalCorsTest extends TestCase
{
    public function test_only_exact_warning_headers_are_exposed_without_expanding_origins(): void
    {
        $this->assertSame(['X-PetPosture-Cache-Warning', 'X-PetPosture-Cache-Recovery'], config('cors.exposed_headers'));
        $this->assertNotContains('*', config('cors.allowed_origins'));
        $this->assertTrue(config('cors.supports_credentials'));
    }
}
