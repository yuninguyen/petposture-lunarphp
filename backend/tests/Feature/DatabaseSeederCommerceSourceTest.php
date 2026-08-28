<?php

namespace Tests\Feature;

use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DatabaseSeederCommerceSourceTest extends TestCase
{
    use RefreshDatabase;

    public function test_database_seeder_does_not_write_legacy_commerce_records_directly(): void
    {
        $seeder = new class extends DatabaseSeeder
        {
            public function call($class, $silent = false, array $parameters = [])
            {
                return $this;
            }
        };

        $seeder->run();

        $this->assertDatabaseCount('categories', 0);
        $this->assertDatabaseCount('products', 0);
    }
}
