<?php

declare(strict_types=1);

namespace Tests\Feature\Api\Admin;

use App\Models\CuratorMedia;
use App\Models\User;
use App\Security\AdminAbilityRegistry;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

/**
 * Parity test suite for Phase 6b: System Media Domain Migration.
 *
 * Verifies exact 100% status code parity across all 7 roles for system media endpoints:
 * - GET /api/admin/system/media (view_any_system_media)
 * - DELETE /api/admin/system/media/{source}/{id} (delete_system_media)
 *
 * - Allowed (super_admin, admin, staff): 200, 204.
 * - Blocked (Product Manager, Order Manager, Support, customer): 403 Forbidden.
 */
class SystemMediaAbilityParityTest extends TestCase
{
    use RefreshDatabase;

    private const ALLOWED_ROLES = [
        'super_admin',
        'admin',
        'staff',
    ];

    private const BLOCKED_ROLES = [
        'Product Manager',
        'Order Manager',
        'Support',
        'customer',
    ];

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
    }

    public function test_allowed_roles_can_list_system_media(): void
    {
        CuratorMedia::query()->create([
            'disk' => 'public',
            'directory' => 'media',
            'visibility' => 'public',
            'name' => 'sys_sample.jpg',
            'path' => 'media/sys_sample.jpg',
            'width' => 100,
            'height' => 100,
            'size' => 1024,
            'type' => 'image',
            'ext' => 'jpg',
            'folder' => CuratorMedia::FOLDER_GENERAL,
        ]);

        foreach (self::ALLOWED_ROLES as $role) {
            $this->actingAsRole($role);

            $response = $this->getJson('/api/admin/system/media');

            $response->assertOk(
                "Role '{$role}' must be permitted to view system media (GET /api/admin/system/media)."
            );
        }
    }

    public function test_blocked_roles_cannot_list_system_media(): void
    {
        foreach (self::BLOCKED_ROLES as $role) {
            $this->actingAsRole($role);

            $response = $this->getJson('/api/admin/system/media');

            $response->assertForbidden(
                "Role '{$role}' must be forbidden from viewing system media (GET /api/admin/system/media)."
            );
        }
    }

    public function test_allowed_roles_can_delete_system_media(): void
    {
        foreach (self::ALLOWED_ROLES as $role) {
            $media = CuratorMedia::query()->create([
                'disk' => 'public',
                'directory' => 'media',
                'visibility' => 'public',
                'name' => "delete_{$role}.jpg",
                'path' => "media/delete_{$role}.jpg",
                'width' => 100,
                'height' => 100,
                'size' => 1024,
                'type' => 'image',
                'ext' => 'jpg',
                'folder' => CuratorMedia::FOLDER_GENERAL,
            ]);

            $this->actingAsRole($role);

            $response = $this->deleteJson("/api/admin/system/media/curator/{$media->id}");

            $response->assertNoContent();
            $this->assertDatabaseMissing('curator_media', ['id' => $media->id]);
        }
    }

    public function test_blocked_roles_cannot_delete_system_media(): void
    {
        $media = CuratorMedia::query()->create([
            'disk' => 'public',
            'directory' => 'media',
            'visibility' => 'public',
            'name' => 'protected.jpg',
            'path' => 'media/protected.jpg',
            'width' => 100,
            'height' => 100,
            'size' => 1024,
            'type' => 'image',
            'ext' => 'jpg',
            'folder' => CuratorMedia::FOLDER_GENERAL,
        ]);

        foreach (self::BLOCKED_ROLES as $role) {
            $this->actingAsRole($role);

            $response = $this->deleteJson("/api/admin/system/media/curator/{$media->id}");

            $response->assertForbidden(
                "Role '{$role}' must be forbidden from deleting system media (DELETE /api/admin/system/media/curator/{$media->id})."
            );
            $this->assertDatabaseHas('curator_media', ['id' => $media->id]);
        }
    }

    public function test_migration_seeds_and_assigns_system_media_permissions_to_core_roles_only(): void
    {
        $migration = require database_path('migrations/2026_09_22_000002_seed_system_media_domain_permissions.php');
        $migration->up();

        $admin = Role::query()->where('name', 'admin')->where('guard_name', 'web')->first();
        $this->assertNotNull($admin);

        foreach (AdminAbilityRegistry::SYSTEM_MEDIA as $permission) {
            $this->assertTrue(
                $admin->hasPermissionTo($permission),
                "Admin must have permission '{$permission}' after migration."
            );
        }

        foreach (['Product Manager', 'Order Manager', 'Support'] as $businessRole) {
            $role = Role::query()->where('name', $businessRole)->where('guard_name', 'web')->first();
            $this->assertNotNull($role);

            foreach (AdminAbilityRegistry::SYSTEM_MEDIA as $permission) {
                $this->assertFalse(
                    $role->hasPermissionTo($permission),
                    "Business role '{$businessRole}' must NOT have permission '{$permission}'."
                );
            }
        }
    }

    public function test_unauthenticated_request_is_unauthorized(): void
    {
        $this->getJson('/api/admin/system/media')->assertUnauthorized();
        $this->deleteJson('/api/admin/system/media/curator/1')->assertUnauthorized();
    }

    private function actingAsRole(string $role): User
    {
        $user = User::factory()->create();
        $user->assignRole($role);
        Sanctum::actingAs($user);

        return $user;
    }
}
