<?php

namespace Tests;

use Illuminate\Foundation\Testing\TestCase as BaseTestCase;

abstract class TestCase extends BaseTestCase
{
    protected function tearDown(): void
    {
        try {
            \Tests\Fixtures\StorefrontHttp::assertNoUnexpectedRequests();
        } finally {
            parent::tearDown();
        }
    }
}
