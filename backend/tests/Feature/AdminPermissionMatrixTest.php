<?php

namespace Tests\Feature;

use App\Http\Controllers\Api\PostController;
use App\Models\BlogCategory;
use App\Models\Post;
use App\Models\Review;
use App\Models\User;
use App\Policies\ReviewPolicy;
use App\Security\AdminPermissionMatrix;
use Database\Seeders\RoleSeeder;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Request;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class AdminPermissionMatrixTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
    }

    public function test_role_seeding_preserves_existing_filament_permissions_for_core_admins(): void
    {
        $permission = Permission::query()->create([
            'name' => 'view_any_brand',
            'guard_name' => 'web',
        ]);
        Role::findByName('admin')->givePermissionTo($permission);

        $this->seed(RoleSeeder::class);

        $this->assertTrue(Role::findByName('admin')->hasPermissionTo('view_any_brand'));
    }

    public function test_role_seeding_does_not_rewrite_customer_permissions(): void
    {
        $permission = Permission::query()->create([
            'name' => 'view_customer_portal',
            'guard_name' => 'web',
        ]);
        Role::findByName('customer')->givePermissionTo($permission);

        $this->seed(RoleSeeder::class);

        $this->assertTrue(Role::findByName('customer')->hasPermissionTo('view_customer_portal'));
    }

    public function test_product_manager_can_enter_product_api_but_not_post_api(): void
    {
        $user = $this->userWithRole('Product Manager');
        Sanctum::actingAs($user);

        $this->getJson('/api/admin/products')->assertOk();
        $this->getJson('/api/admin/breeds')->assertOk();
        $this->getJson('/api/admin/solutions')->assertOk();
        $this->getJson('/api/admin/posts')->assertForbidden();
    }

    public function test_business_roles_receive_the_explicit_domain_permissions(): void
    {
        $productManager = $this->userWithRole('Product Manager');
        $orderManager = $this->userWithRole('Order Manager');
        $support = $this->userWithRole('Support');

        $this->assertTrue($productManager->can('publish_product'));
        $this->assertTrue($productManager->can('update_review'));
        $this->assertFalse($productManager->can('view_any_order'));
        $this->assertFalse($productManager->can('publish_post'));

        $this->assertTrue($orderManager->can('view_any_order'));
        $this->assertTrue($orderManager->can('update_order'));
        $this->assertTrue($orderManager->can('refund_order'));
        $this->assertFalse($orderManager->can('update_product'));

        $this->assertTrue($support->can('view_any_order'));
        $this->assertTrue($support->can('update_order'));
        $this->assertFalse($support->can('refund_order'));
        $this->assertTrue($support->can('update_review'));
    }

    public function test_review_moderation_policy_uses_the_same_matrix(): void
    {
        $review = new Review;
        $productManager = $this->userWithRole('Product Manager');
        $support = $this->userWithRole('Support');
        $orderManager = $this->userWithRole('Order Manager');
        $policy = app(ReviewPolicy::class);

        $this->assertTrue($policy->update($productManager, $review));
        $this->assertTrue($policy->update($support, $review));
        $this->assertFalse($policy->update($orderManager, $review));
    }

    public function test_product_manager_can_mutate_products_but_support_cannot(): void
    {
        Sanctum::actingAs($this->userWithRole('Product Manager'));
        $this->postJson('/api/admin/products', [])->assertUnprocessable();

        Sanctum::actingAs($this->userWithRole('Support'));
        $this->postJson('/api/admin/products', [])->assertForbidden();
    }

    public function test_order_list_is_available_to_order_manager_and_support_but_not_product_manager(): void
    {
        Sanctum::actingAs($this->userWithRole('Order Manager'));
        $this->getJson('/api/admin/orders')->assertOk();

        Sanctum::actingAs($this->userWithRole('Support'));
        $this->getJson('/api/admin/orders')->assertOk();

        Sanctum::actingAs($this->userWithRole('Product Manager'));
        $this->getJson('/api/admin/orders')->assertForbidden();
    }

    public function test_order_manager_can_refund_but_support_cannot(): void
    {
        Sanctum::actingAs($this->userWithRole('Order Manager'));
        $this->postJson('/api/admin/orders/999999/refund')->assertNotFound();

        Sanctum::actingAs($this->userWithRole('Support'));
        $this->postJson('/api/admin/orders/999999/refund')->assertForbidden();
    }

    public function test_filament_order_actions_hide_refund_without_refund_permission(): void
    {
        $source = file_get_contents(app_path('Filament/Resources/OrderResource/Pages/ViewOrder.php'));

        $this->assertIsString($source);
        $this->assertStringContainsString("can('update_order')", $source);
        $this->assertStringContainsString("can('refund_order')", $source);
    }

    public function test_post_edit_permission_does_not_implicitly_grant_publish(): void
    {
        $editorRole = Role::query()->create(['name' => 'Post Editor', 'guard_name' => 'web']);
        $editorRole->givePermissionTo('update_post');
        $editor = User::factory()->create();
        $editor->assignRole($editorRole);
        Sanctum::actingAs($editor);
        $category = BlogCategory::factory()->create();
        $post = Post::query()->create([
            'blog_category_id' => $category->id,
            'type' => Post::TYPE_ARTICLE,
            'title' => 'Permission Matrix Post',
            'slug' => 'permission-matrix-post',
            'content' => 'Draft content.',
            'status' => 'draft',
        ]);
        $controller = app(PostController::class);

        $draftRequest = Request::create('/api/admin/posts/'.$post->id, 'PATCH', ['status' => 'draft']);
        $draftRequest->setUserResolver(fn () => $editor);
        $controller->update($draftRequest, $post);
        $this->assertSame('draft', $post->refresh()->status);

        $publishRequest = Request::create('/api/admin/posts/'.$post->id, 'PATCH', ['status' => 'published']);
        $publishRequest->setUserResolver(fn () => $editor);

        $this->expectException(AuthorizationException::class);
        $controller->update($publishRequest, $post->refresh());
    }

    public function test_every_admin_api_route_has_fail_closed_permission_middleware(): void
    {
        $routes = collect(app('router')->getRoutes()->getRoutes())
            ->filter(fn ($route) => str_starts_with($route->uri(), 'api/admin/') || str_starts_with($route->uri(), 'api/v1/admin/'));

        $this->assertNotEmpty($routes);
        foreach ($routes as $route) {
            $this->assertContains('admin.permission', $route->gatherMiddleware(), $route->uri());
        }
    }

    public function test_support_can_update_orders_but_cannot_refund(): void
    {
        $support = $this->userWithRole('Support');
        Sanctum::actingAs($support);

        $this->patchJson('/api/orders/999999', ['internal_note' => 'Customer contacted.'])
            ->assertNotFound();
        $this->postJson('/api/admin/orders/999999/refund')
            ->assertForbidden();
    }

    public function test_create_order_permission_matches_update_order_for_every_admin_role(): void
    {
        foreach (['super_admin', 'admin', 'staff', 'Order Manager', 'Support', 'Product Manager'] as $role) {
            $user = $this->userWithRole($role);

            $this->assertSame(
                $user->can('update_order'),
                $user->can('create_order'),
                "{$role} must have create_order exactly when it has update_order.",
            );
        }
    }

    public function test_reseeding_does_not_overwrite_already_customized_business_role_permissions(): void
    {
        $productManager = Role::findByName('Product Manager');
        $this->assertFalse($productManager->hasPermissionTo('view_any_order'));

        $productManager->givePermissionTo('view_any_order');
        $this->assertTrue($productManager->hasPermissionTo('view_any_order'));

        (new RoleSeeder)->run();

        $productManager->refresh();
        $this->assertTrue($productManager->hasPermissionTo('view_any_order'));
        $this->assertTrue($productManager->hasPermissionTo('publish_product'));
        $this->assertTrue($productManager->hasPermissionTo('update_review'));
    }

    public function test_reseeding_does_not_remove_permission_manually_revoked_from_business_role(): void
    {
        $orderManager = Role::findByName('Order Manager');
        $this->assertTrue($orderManager->hasPermissionTo('refund_order'));

        $orderManager->revokePermissionTo('refund_order');
        $this->assertFalse($orderManager->hasPermissionTo('refund_order'));

        (new RoleSeeder)->run();

        $orderManager->refresh();
        $this->assertFalse($orderManager->hasPermissionTo('refund_order'));
        $this->assertTrue($orderManager->hasPermissionTo('view_any_order'));
    }

    public function test_fresh_role_with_zero_permissions_still_gets_seeded_from_matrix(): void
    {
        Role::findByName('Order Manager')->delete();
        $orderManager = Role::query()->create(['name' => 'Order Manager', 'guard_name' => 'web']);
        $this->assertSame(0, $orderManager->permissions()->count());

        (new RoleSeeder)->run();

        $orderManager->refresh();
        $expectedPermissions = AdminPermissionMatrix::permissionsForRole('Order Manager');
        $this->assertNotEmpty($expectedPermissions);
        $this->assertCount(count($expectedPermissions), $orderManager->permissions);
        foreach ($expectedPermissions as $permission) {
            $this->assertTrue($orderManager->hasPermissionTo($permission));
        }
    }

    private function userWithRole(string $role): User
    {
        $user = User::factory()->create();
        $user->assignRole($role);

        return $user;
    }
}
