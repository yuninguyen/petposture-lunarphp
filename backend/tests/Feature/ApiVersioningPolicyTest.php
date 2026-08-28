<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Route;
use Tests\TestCase;

class ApiVersioningPolicyTest extends TestCase
{
    use RefreshDatabase;

    public function test_bare_api_is_canonical_and_v1_alias_is_not_registered(): void
    {
        $this->getJson('/api/settings')->assertOk();
        $this->getJson('/api/v1/settings')->assertNotFound();

        $routes = Route::getRoutes();
        $this->assertNotNull($routes->getByName('products.show'));
        $this->assertNotNull($routes->getByName('posts.show'));
        $getRoutes = collect($routes->get('GET'));
        $this->assertCount(1, $getRoutes->filter(fn ($route) => $route->uri() === 'api/products/{slug}'));
        $this->assertCount(1, $getRoutes->filter(fn ($route) => $route->uri() === 'api/posts/{slug}'));
    }
}
