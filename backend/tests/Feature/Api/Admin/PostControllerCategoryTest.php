<?php

namespace Tests\Feature\Api\Admin;

use App\Models\BlogCategory;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class PostControllerCategoryTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Role::firstOrCreate(['name' => 'admin', 'guard_name' => 'web']);
        $user = User::factory()->create();
        $user->assignRole('admin');
        Sanctum::actingAs($user);
    }

    public function test_store_creates_category_with_auto_slug(): void
    {
        $response = $this->postJson('/api/admin/blog/categories', ['name' => 'Chăm sóc'])
            ->assertCreated();

        $this->assertSame('Chăm sóc', $response->json('name'));
        $this->assertStringStartsWith('cham-soc', $response->json('slug'));
        $this->assertDatabaseHas('blog_categories', ['name' => 'Chăm sóc']);
    }

    public function test_store_accepts_explicit_unique_slug(): void
    {
        $this->postJson('/api/admin/blog/categories', ['name' => 'Care', 'slug' => 'care'])
            ->assertCreated();

        $this->assertDatabaseHas('blog_categories', ['slug' => 'care']);
    }

    public function test_store_rejects_duplicate_slug(): void
    {
        BlogCategory::create(['name' => 'Existing', 'slug' => 'care']);

        $this->postJson('/api/admin/blog/categories', ['name' => 'Care', 'slug' => 'care'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['slug']);
    }

    public function test_store_requires_a_name(): void
    {
        $this->postJson('/api/admin/blog/categories', ['name' => ''])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['name']);
    }
}
