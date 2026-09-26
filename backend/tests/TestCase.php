<?php

namespace Tests;

use Illuminate\Foundation\Testing\TestCase as BaseTestCase;
use Tests\Fixtures\StorefrontHttp;

abstract class TestCase extends BaseTestCase
{
    protected function tearDown(): void
    {
        try {
            StorefrontHttp::assertNoUnexpectedRequests();
        } finally {
            parent::tearDown();
        }
    }
}
