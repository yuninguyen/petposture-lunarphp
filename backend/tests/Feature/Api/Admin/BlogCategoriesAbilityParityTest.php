<?php

declare(strict_types=1);

namespace Tests\Feature\Api\Admin;

use App\Models\BlogCategory;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class BlogCategoriesAbilityParityTest extends TestCase
{
    use RefreshDatabase;

    private const ALLOWED = ['super_admin', 'admin', 'staff'];

    private const BLOCKED = ['Product Manager', 'Order Manager', 'Support', 'customer'];

    private const ABILITIES = ['view_any_blog_category', 'view_blog_category', 'create_blog_category', 'update_blog_category', 'delete_blog_category', 'delete_any_blog_category'];

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
    }

    public function test_allowed_roles_can_enter_every_blog_category_route(): void
    {
        foreach (self::ALLOWED as $role) {
            $this->actAs($role);
            foreach ($this->requests() as [$method, $uri, $payload]) {
                $this->assertNotSame(403, $this->{$method}($uri, $payload)->getStatusCode(), "{$role}: {$method} {$uri}");
            }
        }
    }

    public function test_blocked_roles_are_forbidden_from_every_blog_category_route(): void
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

    public function test_migration_assigns_only_underscore_abilities_to_core_roles(): void
    {
        (require database_path('migrations/2026_09_23_000003_seed_blog_categories_domain_permissions.php'))->up();
        foreach (self::ALLOWED as $role) {
            foreach (self::ABILITIES as $ability) {
                $this->assertTrue(Role::findByName($role)->hasPermissionTo($ability));
            }
        }
        foreach (self::BLOCKED as $role) {
            foreach (self::ABILITIES as $ability) {
                $this->assertFalse(Role::findByName($role)->hasPermissionTo($ability));
            }
        }
        $this->assertSame(0, Permission::query()->where('name', 'like', '%blog::category')->count());
    }

    private function requests(): array
    {
        $category = BlogCategory::query()->create(['name' => 'Parity '.uniqid(), 'slug' => 'parity-'.uniqid()]);

        return [['getJson', '/api/admin/blog/categories', []], ['postJson', '/api/admin/blog/categories', []], ['getJson', "/api/admin/blog/categories/{$category->id}", []], ['putJson', "/api/admin/blog/categories/{$category->id}", []], ['deleteJson', "/api/admin/blog/categories/{$category->id}", []], ['postJson', '/api/admin/blog/categories/bulk-delete', []]];
    }

    private function actAs(string $role): void
    {
        $user = User::factory()->create();
        $user->assignRole($role);
        Sanctum::actingAs($user);
    }
}
