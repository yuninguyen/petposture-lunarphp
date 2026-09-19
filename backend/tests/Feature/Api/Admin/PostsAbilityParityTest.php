<?php

declare(strict_types=1);

namespace Tests\Feature\Api\Admin;

use App\Models\BlogCategory;
use App\Models\Post;
use App\Models\User;
use App\Security\AdminAbilityRegistry;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class PostsAbilityParityTest extends TestCase
{
    use RefreshDatabase;

    private const ALLOWED = ['super_admin', 'admin', 'staff'];
    private const BLOCKED = ['Product Manager', 'Order Manager', 'Support', 'customer'];

    protected function setUp(): void { parent::setUp(); $this->seed(RoleSeeder::class); }

    public function test_allowed_roles_can_enter_every_post_route(): void
    {
        foreach (self::ALLOWED as $role) {
            $this->actAs($role);
            foreach ($this->requests() as [$method, $uri, $payload]) {
                $response = $this->{$method}($uri, $payload);
                $this->assertNotSame(403, $response->getStatusCode(), "{$role}: {$method} {$uri}");
            }
        }
    }

    public function test_blocked_roles_are_forbidden_from_every_post_route(): void
    {
        foreach (self::BLOCKED as $role) {
            $this->actAs($role);
            foreach ($this->requests() as [$method, $uri, $payload]) {
                $this->assertSame(403, $this->{$method}($uri, $payload)->getStatusCode(), "{$role}: {$method} {$uri}");
            }
        }
    }

    public function test_unauthenticated_requests_are_unauthorized(): void
    {
        foreach ($this->requests() as [$method, $uri, $payload]) {
            $this->{$method}($uri, $payload)->assertUnauthorized();
        }
    }

    public function test_migration_assigns_post_abilities_only_to_core_roles(): void
    {
        (require database_path('migrations/2026_09_23_000002_seed_posts_domain_permissions.php'))->up();
        foreach (self::ALLOWED as $role) foreach (AdminAbilityRegistry::POSTS as $ability) $this->assertTrue(Role::findByName($role)->hasPermissionTo($ability));
        foreach (self::BLOCKED as $role) foreach (AdminAbilityRegistry::POSTS as $ability) $this->assertFalse(Role::findByName($role)->hasPermissionTo($ability));
    }

    private function requests(): array
    {
        $suffix = uniqid();
        $category = BlogCategory::query()->create(['name' => 'Parity category '.$suffix, 'slug' => 'parity-category-'.$suffix]);
        $post = Post::query()->create(['blog_category_id' => $category->id, 'title' => 'Parity post '.$suffix, 'slug' => 'parity-'.$suffix, 'content' => '<p>Parity</p>', 'status' => 'draft']);
        return [
            ['getJson', '/api/admin/posts', []], ['getJson', "/api/admin/posts/{$post->id}", []], ['getJson', "/api/admin/posts/{$post->id}/preview-url", []],
            ['postJson', '/api/admin/posts', []], ['putJson', "/api/admin/posts/{$post->id}", []], ['deleteJson', "/api/admin/posts/{$post->id}", []],
            ['postJson', '/api/admin/posts/bulk-delete', []], ['postJson', "/api/admin/posts/{$post->id}/duplicate", []], ['postJson', '/api/admin/posts/generate-seo', []],
        ];
    }

    private function actAs(string $role): void { $user = User::factory()->create(); $user->assignRole($role); Sanctum::actingAs($user); }
}
