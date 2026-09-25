<?php

namespace Tests\Feature\Api\Admin;

use App\Models\User;
use App\Security\AdminAbilityRegistry;
use App\Security\AdminPermissionMatrix;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class RoleControllerTest extends TestCase
{
    use RefreshDatabase;

    protected User $admin;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(RoleSeeder::class);

        $this->admin = User::factory()->create();
        $this->admin->assignRole('admin');
    }

    public function test_unauthenticated_request_is_rejected(): void
    {
        $this->getJson('/api/admin/system/roles')->assertUnauthorized();
        $this->putJson('/api/admin/system/roles/1', ['permissions' => []])->assertUnauthorized();
    }

    public function test_non_core_admin_users_cannot_access_roles_endpoints_returns_403(): void
    {
        $orderManagerRole = Role::findByName('Order Manager', 'web');

        foreach (['Product Manager', 'Order Manager', 'Support', 'customer'] as $roleName) {
            $user = User::factory()->create();
            $user->assignRole($roleName);

            Sanctum::actingAs($user);

            $this->getJson('/api/admin/system/roles')->assertForbidden();
            $this->putJson("/api/admin/system/roles/{$orderManagerRole->id}", [
                'permissions' => ['view_any_order'],
            ])->assertForbidden();
        }
    }

    public function test_index_returns_six_admin_roles_with_editable_flags_and_filters_out_junk_permissions(): void
    {
        // Seed a junk permission and give it to Product Manager
        $junkPermission = Permission::firstOrCreate([
            'name' => 'settings:core',
            'guard_name' => 'web',
        ]);
        Role::findByName('Product Manager', 'web')->givePermissionTo($junkPermission);

        Sanctum::actingAs($this->admin);

        $response = $this->getJson('/api/admin/system/roles')->assertOk();

        $data = $response->json('data');
        $this->assertCount(6, $data);

        $roleNames = collect($data)->pluck('name')->all();
        $this->assertEqualsCanonicalizing(User::ADMIN_PANEL_ROLES, $roleNames);

        $rolesByName = collect($data)->keyBy('name');

        // Check editable flags
        $this->assertFalse($rolesByName['super_admin']['editable']);
        $this->assertFalse($rolesByName['admin']['editable']);
        $this->assertFalse($rolesByName['staff']['editable']);
        $this->assertTrue($rolesByName['Product Manager']['editable']);
        $this->assertTrue($rolesByName['Order Manager']['editable']);
        $this->assertTrue($rolesByName['Support']['editable']);

        // Check junk permission is filtered out from response
        $this->assertNotContains('settings:core', $rolesByName['Product Manager']['permissions']);

        // Check permission groups match registry domains
        $groups = $response->json('permission_groups');
        $this->assertIsArray($groups);
        $this->assertNotEmpty($groups);
        $groupsByKey = collect($groups)->keyBy('key');
        $this->assertTrue($groupsByKey->has('products'));
        $this->assertTrue($groupsByKey->has('orders'));
        $this->assertTrue($groupsByKey->has('reviews'));
        $this->assertTrue($groupsByKey->has('posts'));
        $this->assertEqualsCanonicalizing(AdminAbilityRegistry::PRODUCTS, $groupsByKey['products']['abilities']);
        $this->assertEqualsCanonicalizing(AdminAbilityRegistry::ORDERS, $groupsByKey['orders']['abilities']);
        $this->assertEqualsCanonicalizing(AdminAbilityRegistry::REVIEWS, $groupsByKey['reviews']['abilities']);
        $this->assertEqualsCanonicalizing(AdminAbilityRegistry::POSTS, $groupsByKey['posts']['abilities']);
    }

    public function test_update_permissions_for_business_role_succeeds_and_updates_database(): void
    {
        Sanctum::actingAs($this->admin);

        $orderManager = Role::findByName('Order Manager', 'web');
        $newPermissions = ['view_any_order', 'view_order', 'create_order'];

        $response = $this->putJson("/api/admin/system/roles/{$orderManager->id}", [
            'permissions' => $newPermissions,
        ])->assertOk();

        $this->assertSame($orderManager->id, $response->json('data.id'));
        $this->assertSame('Order Manager', $response->json('data.name'));
        $this->assertTrue($response->json('data.editable'));
        $this->assertEqualsCanonicalizing($newPermissions, $response->json('data.permissions'));

        $orderManager->refresh();
        $this->assertEqualsCanonicalizing($newPermissions, $orderManager->permissions->pluck('name')->all());
        $this->assertFalse($orderManager->hasPermissionTo('refund_order'));
    }

    public function test_update_permissions_for_core_admin_roles_returns_403(): void
    {
        Sanctum::actingAs($this->admin);

        foreach (['super_admin', 'admin', 'staff'] as $roleName) {
            $role = Role::findByName($roleName, 'web');
            $initialCount = $role->permissions()->count();

            $response = $this->putJson("/api/admin/system/roles/{$role->id}", [
                'permissions' => ['view_any_order'],
            ])->assertForbidden();

            $this->assertStringContainsString('This role always has full access and cannot be edited.', $response->json('message'));
            $this->assertSame($initialCount, $role->refresh()->permissions()->count());
        }
    }

    public function test_update_permissions_rejects_permissions_outside_valid_matrix_with_422(): void
    {
        Sanctum::actingAs($this->admin);

        $orderManager = Role::findByName('Order Manager', 'web');
        $initialPermissions = $orderManager->permissions->pluck('name')->all();

        // 1. Invalid permission string
        $this->putJson("/api/admin/system/roles/{$orderManager->id}", [
            'permissions' => ['view_any_order', 'completely_fake_permission'],
        ])->assertUnprocessable()
            ->assertJsonValidationErrors('permissions.1');

        // 2. Permission that exists in DB but is not in AdminPermissionMatrix
        Permission::firstOrCreate(['name' => 'settings:core', 'guard_name' => 'web']);
        $this->putJson("/api/admin/system/roles/{$orderManager->id}", [
            'permissions' => ['settings:core'],
        ])->assertUnprocessable()
            ->assertJsonValidationErrors('permissions.0');

        $this->assertEqualsCanonicalizing($initialPermissions, $orderManager->refresh()->permissions->pluck('name')->all());
    }

    public function test_update_permissions_returns_404_for_non_admin_roles(): void
    {
        Sanctum::actingAs($this->admin);

        $customerRole = Role::findByName('customer', 'web');

        $this->putJson("/api/admin/system/roles/{$customerRole->id}", [
            'permissions' => ['view_any_order'],
        ])->assertNotFound();

        $this->putJson('/api/admin/system/roles/999999', [
            'permissions' => ['view_any_order'],
        ])->assertNotFound();
    }
}
