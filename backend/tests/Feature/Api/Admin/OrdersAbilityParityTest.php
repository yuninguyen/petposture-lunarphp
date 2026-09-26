<?php

declare(strict_types=1);

namespace Tests\Feature\Api\Admin;

use App\Models\ShippingMethod;
use App\Models\User;
use App\Security\AdminAbilityRegistry;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Lunar\Models\Product;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

/**
 * Parity tests for Phase 6b, domain #26: Orders.
 *
 * GET product-picker routes intentionally require update_order. All other GET
 * routes require view_any_order; POST orders requires create_order; refund is
 * exclusive to Order Manager among the two business order roles.
 */
class OrdersAbilityParityTest extends TestCase
{
    use RefreshDatabase;

    private const ALLOWED_ROLES = [
        'super_admin',
        'admin',
        'staff',
        'Order Manager',
        'Support',
    ];

    private const BLOCKED_ROLES = [
        'Product Manager',
        'customer',
    ];

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
    }

    public function test_allowed_roles_can_index_and_show_orders(): void
    {
        foreach (self::ALLOWED_ROLES as $role) {
            $this->actingAsRole($role);

            $this->getJson('/api/admin/orders')->assertOk();
            $this->getJson('/api/admin/orders/999999')->assertNotFound();
        }
    }

    public function test_blocked_roles_cannot_index_or_show_orders(): void
    {
        foreach (self::BLOCKED_ROLES as $role) {
            $this->actingAsRole($role);

            $this->getJson('/api/admin/orders')->assertForbidden();
            $this->getJson('/api/admin/orders/999999')->assertForbidden();
        }
    }

    public function test_allowed_roles_can_create_orders(): void
    {
        foreach (self::ALLOWED_ROLES as $role) {
            $this->actingAsRole($role);

            $this->postJson('/api/admin/orders', [])->assertUnprocessable();
        }
    }

    public function test_blocked_roles_cannot_create_orders(): void
    {
        foreach (self::BLOCKED_ROLES as $role) {
            $this->actingAsRole($role);

            $this->postJson('/api/admin/orders', [])->assertForbidden();
        }
    }

    public function test_allowed_roles_can_use_order_product_picker_routes(): void
    {
        $product = Product::factory()->create();

        foreach (self::ALLOWED_ROLES as $role) {
            $this->actingAsRole($role);

            $this->getJson('/api/admin/orders/product-picker')->assertOk();
            $this->getJson('/api/admin/orders/product-picker/'.$product->id.'/variants')->assertOk();
        }
    }

    public function test_blocked_roles_cannot_use_order_product_picker_routes(): void
    {
        $product = Product::factory()->create();

        foreach (self::BLOCKED_ROLES as $role) {
            $this->actingAsRole($role);

            $this->getJson('/api/admin/orders/product-picker')->assertForbidden();
            $this->getJson('/api/admin/orders/product-picker/'.$product->id.'/variants')->assertForbidden();
        }
    }

    public function test_shipping_method_picker_follows_the_same_ability_as_the_product_picker(): void
    {
        ShippingMethod::query()->firstOrCreate(
            ['code' => 'standard'],
            ['name' => 'Standard Shipping', 'price' => 5]
        );

        foreach (self::ALLOWED_ROLES as $role) {
            $this->actingAsRole($role);

            $response = $this->getJson('/api/admin/orders/shipping-methods')->assertOk();
            $this->assertSame(
                ['code', 'eta', 'free_over', 'name', 'price'],
                collect(array_keys($response->json('data.0') ?? []))->sort()->values()->all(),
                $role
            );
        }

        foreach (self::BLOCKED_ROLES as $role) {
            $this->actingAsRole($role);

            $this->getJson('/api/admin/orders/shipping-methods')->assertForbidden();
        }
    }

    public function test_refund_remains_exclusive_to_order_manager(): void
    {
        foreach (['super_admin', 'admin', 'staff', 'Order Manager'] as $role) {
            $this->actingAsRole($role);

            $this->postJson('/api/admin/orders/999999/refund')->assertNotFound();
        }

        $this->actingAsRole('Support');
        $this->postJson('/api/admin/orders/999999/refund')->assertForbidden();

        foreach (self::BLOCKED_ROLES as $role) {
            $this->actingAsRole($role);

            $this->postJson('/api/admin/orders/999999/refund')->assertForbidden();
        }
    }

    public function test_allowed_roles_can_return_orders(): void
    {
        foreach (self::ALLOWED_ROLES as $role) {
            $this->actingAsRole($role);

            $this->postJson('/api/admin/orders/999999/return')->assertNotFound();
        }
    }

    public function test_blocked_roles_cannot_return_orders(): void
    {
        foreach (self::BLOCKED_ROLES as $role) {
            $this->actingAsRole($role);

            $this->postJson('/api/admin/orders/999999/return')->assertForbidden();
        }
    }

    public function test_migration_assigns_the_exact_order_ability_sets(): void
    {
        $migration = require database_path('migrations/2026_09_23_000001_seed_orders_domain_permissions.php');
        $migration->up();

        foreach (AdminAbilityRegistry::coreRoles() as $roleName) {
            $role = Role::findByName($roleName);

            foreach (AdminAbilityRegistry::ORDERS as $permission) {
                $this->assertTrue($role->hasPermissionTo($permission));
            }
        }

        $orderManager = Role::findByName('Order Manager');
        foreach (['view_any_order', 'view_order', 'create_order', 'update_order', 'refund_order'] as $permission) {
            $this->assertTrue($orderManager->hasPermissionTo($permission));
        }
        $this->assertFalse($orderManager->hasPermissionTo('delete_order'));
        $this->assertFalse($orderManager->hasPermissionTo('delete_any_order'));

        $support = Role::findByName('Support');
        foreach (['view_any_order', 'view_order', 'create_order', 'update_order'] as $permission) {
            $this->assertTrue($support->hasPermissionTo($permission));
        }
        $this->assertFalse($support->hasPermissionTo('refund_order'));
        $this->assertFalse($support->hasPermissionTo('delete_order'));
        $this->assertFalse($support->hasPermissionTo('delete_any_order'));
    }

    public function test_unauthenticated_requests_are_unauthorized(): void
    {
        $this->getJson('/api/admin/orders')->assertUnauthorized();
        $this->getJson('/api/admin/orders/1')->assertUnauthorized();
        $this->postJson('/api/admin/orders', [])->assertUnauthorized();
        $this->getJson('/api/admin/orders/product-picker')->assertUnauthorized();
        $this->getJson('/api/admin/orders/product-picker/1/variants')->assertUnauthorized();
        $this->postJson('/api/admin/orders/1/refund')->assertUnauthorized();
        $this->postJson('/api/admin/orders/1/return')->assertUnauthorized();
    }

    private function actingAsRole(string $role): User
    {
        $user = User::factory()->create();
        $user->assignRole($role);
        Sanctum::actingAs($user);

        return $user;
    }
}
