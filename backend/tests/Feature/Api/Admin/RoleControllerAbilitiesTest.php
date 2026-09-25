<?php

declare(strict_types=1);

namespace Tests\Feature\Api\Admin;

use App\Models\User;
use App\Security\AdminAbilityRegistry;
use App\Security\AdminPermissionMatrix;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Spatie\Activitylog\Models\Activity;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class RoleControllerAbilitiesTest extends TestCase
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

    /**
     * 1. Lưu chỉ với quyền ma trận cũ không xoá quyền registry
     * (regression: Product Manager trước/sau đều còn view_any_brand, khi payload có nó).
     */
    public function test_updating_permissions_with_payload_containing_registry_ability_persists_it(): void
    {
        Sanctum::actingAs($this->admin);

        $pm = Role::findByName('Product Manager', 'web');
        $this->assertTrue($pm->hasPermissionTo('view_any_brand'));

        // Payload with matrix permissions and registry ability (view_any_brand)
        $payload = [
            'view_any_product',
            'publish_product',
            'view_any_brand',
        ];

        $response = $this->putJson("/api/admin/system/roles/{$pm->id}", [
            'permissions' => $payload,
        ])->assertOk();

        $this->assertContains('view_any_brand', $response->json('data.permissions'));
        $this->assertTrue($pm->refresh()->hasPermissionTo('view_any_brand'));
        $this->assertTrue($pm->hasPermissionTo('view_any_product'));
    }

    /**
     * 2. Quyền ngoài tập quản lý (gán thủ công view_any_blog::category) được giữ nguyên sau khi lưu.
     */
    public function test_unmanaged_permissions_outside_registry_and_matrix_are_preserved_on_save(): void
    {
        Sanctum::actingAs($this->admin);

        $unmanagedPerm = Permission::firstOrCreate([
            'name' => 'view_any_blog::category',
            'guard_name' => 'web',
        ]);

        $pm = Role::findByName('Product Manager', 'web');
        $pm->givePermissionTo($unmanagedPerm);
        $this->assertTrue($pm->hasPermissionTo('view_any_blog::category'));

        // Admin saves with a new set of managed permissions
        $payload = [
            'view_any_product',
            'update_product',
        ];

        $response = $this->putJson("/api/admin/system/roles/{$pm->id}", [
            'permissions' => $payload,
        ])->assertOk();

        // Response filters unmanaged permissions to only return managed ones
        $this->assertNotContains('view_any_blog::category', $response->json('data.permissions'));

        // But in the DB, the unmanaged permission is preserved!
        $pm->refresh();
        $this->assertTrue($pm->hasPermissionTo('view_any_blog::category'));
        $this->assertTrue($pm->hasPermissionTo('view_any_product'));
        $this->assertTrue($pm->hasPermissionTo('update_product'));
    }

    /**
     * 3. End-to-end: thêm view_any_customer cho Support qua API, khi đó Support
     * gọi GET /api/admin/customers được 200; thu hồi thì 403.
     */
    public function test_e2e_granting_and_revoking_view_any_customer_for_support_controls_access(): void
    {
        $supportUser = User::factory()->create();
        $supportUser->assignRole('Support');

        // Initially Support cannot access customers endpoint
        Sanctum::actingAs($supportUser);
        $this->getJson('/api/admin/customers')->assertForbidden();

        // Admin grants view_any_customer to Support
        Sanctum::actingAs($this->admin);
        $supportRole = Role::findByName('Support', 'web');
        $currentPermissions = $supportRole->permissions->pluck('name')->all();
        $newPermissions = array_values(array_unique([...$currentPermissions, 'view_any_customer']));

        $this->putJson("/api/admin/system/roles/{$supportRole->id}", [
            'permissions' => $newPermissions,
        ])->assertOk();

        // Support user can now access customers
        Sanctum::actingAs($supportUser);
        $this->getJson('/api/admin/customers')->assertOk();

        // Admin revokes view_any_customer from Support
        Sanctum::actingAs($this->admin);
        $revokedPermissions = array_values(array_diff($newPermissions, ['view_any_customer']));

        $this->putJson("/api/admin/system/roles/{$supportRole->id}", [
            'permissions' => $revokedPermissions,
        ])->assertOk();

        // Support user is forbidden again
        Sanctum::actingAs($supportUser);
        $this->getJson('/api/admin/customers')->assertForbidden();
    }

    /**
     * 4. Core role trả 403; payload có ability lạ trả 422; có activity log khi thay đổi.
     */
    public function test_core_roles_return_403_invalid_ability_returns_422_and_activity_is_logged(): void
    {
        Sanctum::actingAs($this->admin);

        foreach (['super_admin', 'admin', 'staff'] as $coreRoleName) {
            $coreRole = Role::findByName($coreRoleName, 'web');
            $this->putJson("/api/admin/system/roles/{$coreRole->id}", [
                'permissions' => ['view_any_order'],
            ])->assertForbidden();
        }

        $orderManager = Role::findByName('Order Manager', 'web');

        // Payload with unknown ability returns 422
        $this->putJson("/api/admin/system/roles/{$orderManager->id}", [
            'permissions' => ['completely_unknown_fake_ability'],
        ])->assertUnprocessable()
            ->assertJsonValidationErrors('permissions.0');

        // Activity log recorded when permissions change
        $beforeCount = Activity::query()
            ->where('subject_type', $orderManager->getMorphClass())
            ->where('subject_id', $orderManager->id)
            ->where('description', 'permissions_updated')
            ->count();

        $this->putJson("/api/admin/system/roles/{$orderManager->id}", [
            'permissions' => ['view_any_order', 'view_order'],
        ])->assertOk();

        $afterCount = Activity::query()
            ->where('subject_type', $orderManager->getMorphClass())
            ->where('subject_id', $orderManager->id)
            ->where('description', 'permissions_updated')
            ->count();

        $this->assertSame($beforeCount + 1, $afterCount);

        $latestLog = Activity::query()
            ->where('subject_type', $orderManager->getMorphClass())
            ->where('subject_id', $orderManager->id)
            ->where('description', 'permissions_updated')
            ->latest('id')
            ->first();

        $this->assertNotNull($latestLog);
        $this->assertArrayHasKey('before', $latestLog->properties);
        $this->assertArrayHasKey('after', $latestLog->properties);
    }

    /**
     * 5. RoleSeeder chạy lại không cấp lại quyền đã thu hồi
     * (Product Manager thu hồi view_any_brand → reseed → vẫn không có).
     */
    public function test_reseeding_does_not_regrant_revoked_registry_ability(): void
    {
        $pm = Role::findByName('Product Manager', 'web');
        $this->assertTrue($pm->hasPermissionTo('view_any_brand'));

        // Revoke view_any_brand from Product Manager
        $pm->revokePermissionTo('view_any_brand');
        $this->assertFalse($pm->fresh()->hasPermissionTo('view_any_brand'));

        // Re-run RoleSeeder
        (new RoleSeeder)->run();

        // Product Manager still does NOT have view_any_brand
        $this->assertFalse($pm->fresh()->hasPermissionTo('view_any_brand'));
    }
}
