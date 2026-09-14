<?php

namespace Tests\Feature\Api\Admin;

use App\Enums\ErrorCode;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class SystemUserControllerTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(RoleSeeder::class);

        foreach (['super_admin', 'admin', 'staff', 'Product Manager', 'Order Manager', 'Support', 'customer'] as $role) {
            Role::firstOrCreate(['name' => $role, 'guard_name' => 'web']);
        }

        // Migration 2026_05_22_000000_create_production_admin_user always seeds a
        // real super_admin ("Yuni Nguyen") on every migrate, including this
        // in-memory test database. Deactivate it so "last active super admin"
        // guard tests start from a clean baseline of 0 active admins.
        User::query()->update(['is_active' => false]);
    }

    public function test_unauthenticated_requests_are_rejected(): void
    {
        $this->getJson('/api/admin/system/users')->assertUnauthorized();
    }

    public function test_customer_cannot_access_system_users(): void
    {
        Sanctum::actingAs($this->createUserWithRole('customer'));

        $this->getJson('/api/admin/system/users')->assertForbidden();
    }

    public function test_index_only_returns_admin_panel_role_users_excluding_customers(): void
    {
        $admin = $this->createUserWithRole('admin');
        Sanctum::actingAs($admin);

        $staff = $this->createUserWithRole('staff');
        $support = $this->createUserWithRole('Support');
        $orderManager = $this->createUserWithRole('Order Manager');
        $productManager = $this->createUserWithRole('Product Manager');
        $customer = $this->createUserWithRole('customer');

        $response = $this->getJson('/api/admin/system/users')->assertOk();

        $ids = collect($response->json('data'))->pluck('id')->all();

        $this->assertContains($admin->id, $ids);
        $this->assertContains($staff->id, $ids);
        $this->assertContains($support->id, $ids);
        $this->assertContains($orderManager->id, $ids);
        $this->assertContains($productManager->id, $ids);
        $this->assertNotContains($customer->id, $ids);
    }

    public function test_store_creates_system_user_with_hashed_password_and_roles(): void
    {
        $admin = $this->createUserWithRole('admin');
        Sanctum::actingAs($admin);

        $payload = [
            'name' => 'Jane Staff',
            'email' => 'jane.staff@example.com',
            'password' => 'SecurePass123!',
            'roles' => ['staff', 'Support'],
            'is_active' => true,
        ];

        $response = $this->postJson('/api/admin/system/users', $payload)->assertCreated();

        $response->assertJsonPath('data.name', 'Jane Staff');
        $response->assertJsonPath('data.email', 'jane.staff@example.com');
        $response->assertJsonPath('data.is_active', true);
        $this->assertEqualsCanonicalizing(['staff', 'Support'], $response->json('data.roles'));

        $createdUser = User::where('email', 'jane.staff@example.com')->firstOrFail();
        $this->assertTrue(Hash::check('SecurePass123!', $createdUser->password));
        $this->assertTrue($createdUser->hasRole('staff'));
        $this->assertTrue($createdUser->hasRole('Support'));
    }

    public function test_store_validation_requires_password_and_valid_roles(): void
    {
        $admin = $this->createUserWithRole('admin');
        Sanctum::actingAs($admin);

        // Missing password
        $this->postJson('/api/admin/system/users', [
            'name' => 'No Pass',
            'email' => 'nopass@example.com',
            'roles' => ['staff'],
        ])->assertUnprocessable()->assertJsonValidationErrors(['password']);

        // Invalid role (not in ADMIN_PANEL_ROLES)
        $this->postJson('/api/admin/system/users', [
            'name' => 'Bad Role',
            'email' => 'badrole@example.com',
            'password' => 'SecurePass123!',
            'roles' => ['customer'],
        ])->assertUnprocessable()->assertJsonValidationErrors(['roles.0']);

        // Empty roles array
        $this->postJson('/api/admin/system/users', [
            'name' => 'Empty Roles',
            'email' => 'emptyroles@example.com',
            'password' => 'SecurePass123!',
            'roles' => [],
        ])->assertUnprocessable()->assertJsonValidationErrors(['roles']);
    }

    public function test_update_allows_omitting_password_and_preserves_current(): void
    {
        $admin = $this->createUserWithRole('admin');
        Sanctum::actingAs($admin);

        $staff = $this->createUserWithRole('staff', [
            'password' => Hash::make('OriginalPass123!'),
        ]);

        $response = $this->putJson("/api/admin/system/users/{$staff->id}", [
            'name' => 'Updated Staff Name',
            'email' => 'updated.staff@example.com',
            'roles' => ['Support'],
        ])->assertOk();

        $response->assertJsonPath('data.name', 'Updated Staff Name');
        $response->assertJsonPath('data.email', 'updated.staff@example.com');
        $this->assertEqualsCanonicalizing(['Support'], $response->json('data.roles'));

        $staff->refresh();
        $this->assertTrue(Hash::check('OriginalPass123!', $staff->password));
    }

    public function test_update_preserves_non_admin_roles_not_offered_as_checkboxes(): void
    {
        $admin = $this->createUserWithRole('admin');
        Sanctum::actingAs($admin);

        $staff = $this->createUserWithRole('staff');
        $staff->assignRole('customer');

        $this->putJson("/api/admin/system/users/{$staff->id}", [
            'name' => $staff->name,
            'email' => $staff->email,
            'roles' => ['admin'],
        ])->assertOk();

        $staff->refresh();
        $this->assertTrue($staff->hasRole('customer'));
        $this->assertTrue($staff->hasRole('admin'));
        $this->assertFalse($staff->hasRole('staff'));

        // The response and index listing must not surface the non-admin role.
        $response = $this->getJson("/api/admin/system/users/{$staff->id}")->assertOk();
        $this->assertNotContains('customer', $response->json('data.roles'));
    }

    public function test_update_hashes_new_password_when_provided(): void
    {
        $admin = $this->createUserWithRole('admin');
        Sanctum::actingAs($admin);

        $staff = $this->createUserWithRole('staff', [
            'password' => Hash::make('OriginalPass123!'),
        ]);

        $this->putJson("/api/admin/system/users/{$staff->id}", [
            'name' => $staff->name,
            'email' => $staff->email,
            'password' => 'NewSecurePassword!',
            'roles' => ['staff'],
        ])->assertOk();

        $staff->refresh();
        $this->assertTrue(Hash::check('NewSecurePassword!', $staff->password));
    }

    public function test_self_deactivation_is_rejected_with_409_conflict(): void
    {
        $admin = $this->createUserWithRole('admin');
        Sanctum::actingAs($admin);

        $response = $this->putJson("/api/admin/system/users/{$admin->id}", [
            'name' => $admin->name,
            'email' => $admin->email,
            'is_active' => false,
            'roles' => ['admin'],
        ]);

        $response->assertStatus(409)
            ->assertJsonPath('code', ErrorCode::CANNOT_MODIFY_SELF->value)
            ->assertJsonPath('message', 'You cannot disable or delete your own account.');

        $this->assertTrue($admin->refresh()->is_active);
    }

    public function test_self_deletion_is_rejected_with_409_conflict(): void
    {
        $admin = $this->createUserWithRole('admin');
        Sanctum::actingAs($admin);

        $response = $this->deleteJson("/api/admin/system/users/{$admin->id}");

        $response->assertStatus(409)
            ->assertJsonPath('code', ErrorCode::CANNOT_MODIFY_SELF->value)
            ->assertJsonPath('message', 'You cannot disable or delete your own account.');

        $this->assertDatabaseHas('users', ['id' => $admin->id]);
    }

    public function test_deleting_last_active_super_admin_is_rejected_with_409_conflict(): void
    {
        $superAdmin = $this->createUserWithRole('super_admin');
        $admin = $this->createUserWithRole('admin');
        Sanctum::actingAs($admin);

        // Only 1 super admin exists
        $this->assertSame(1, User::role('super_admin')->where('is_active', true)->count());

        $response = $this->deleteJson("/api/admin/system/users/{$superAdmin->id}");

        $response->assertStatus(409)
            ->assertJsonPath('code', ErrorCode::LAST_SUPER_ADMIN->value)
            ->assertJsonPath('message', 'Cannot remove the last active super admin.');

        $this->assertDatabaseHas('users', ['id' => $superAdmin->id]);
    }

    public function test_deleting_super_admin_succeeds_when_another_active_super_admin_exists(): void
    {
        $superAdmin1 = $this->createUserWithRole('super_admin');
        $superAdmin2 = $this->createUserWithRole('super_admin');
        Sanctum::actingAs($superAdmin1);

        $this->assertSame(2, User::role('super_admin')->where('is_active', true)->count());

        $response = $this->deleteJson("/api/admin/system/users/{$superAdmin2->id}");
        $response->assertNoContent();

        $this->assertDatabaseMissing('users', ['id' => $superAdmin2->id]);
    }

    public function test_stripping_super_admin_role_from_last_active_super_admin_is_rejected_with_409(): void
    {
        $superAdmin = $this->createUserWithRole('super_admin');
        $admin = $this->createUserWithRole('admin');
        Sanctum::actingAs($admin);

        $this->assertSame(1, User::role('super_admin')->where('is_active', true)->count());

        $response = $this->putJson("/api/admin/system/users/{$superAdmin->id}", [
            'name' => $superAdmin->name,
            'email' => $superAdmin->email,
            'roles' => ['admin'], // strips super_admin
        ]);

        $response->assertStatus(409)
            ->assertJsonPath('code', ErrorCode::LAST_SUPER_ADMIN->value);

        $this->assertTrue($superAdmin->refresh()->hasRole('super_admin'));
    }

    public function test_deactivating_last_active_super_admin_is_rejected_with_409(): void
    {
        $superAdmin = $this->createUserWithRole('super_admin');
        $admin = $this->createUserWithRole('admin');
        Sanctum::actingAs($admin);

        $this->assertSame(1, User::role('super_admin')->where('is_active', true)->count());

        $response = $this->putJson("/api/admin/system/users/{$superAdmin->id}", [
            'name' => $superAdmin->name,
            'email' => $superAdmin->email,
            'is_active' => false,
            'roles' => ['super_admin'],
        ]);

        $response->assertStatus(409)
            ->assertJsonPath('code', ErrorCode::LAST_SUPER_ADMIN->value);

        $this->assertTrue($superAdmin->refresh()->is_active);
    }

    public function test_legacy_users_selector_route_remains_unmodified(): void
    {
        $admin = $this->createUserWithRole('admin');
        Sanctum::actingAs($admin);

        $customer = $this->createUserWithRole('customer');

        $response = $this->getJson('/api/admin/users')->assertOk();

        $this->assertIsArray($response->json());
        $ids = collect($response->json())->pluck('id')->all();
        $this->assertContains($admin->id, $ids);
        $this->assertContains($customer->id, $ids);
    }

    private function createUserWithRole(string $role, array $attributes = []): User
    {
        $user = User::factory()->create(array_merge([
            'is_active' => true,
        ], $attributes));

        $user->assignRole($role);

        return $user;
    }
}
