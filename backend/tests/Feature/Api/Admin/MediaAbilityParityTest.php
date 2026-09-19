<?php

declare(strict_types=1);

namespace Tests\Feature\Api\Admin;

use App\Models\CuratorMedia;
use App\Models\User;
use App\Security\AdminAbilityRegistry;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

/**
 * Parity test suite for Phase 6b: Media Domain Migration.
 *
 * Verifies exact 100% status code parity across all 7 roles for the actual registered media routes:
 * - GET /api/admin/media (index)
 * - POST /api/admin/media (store)
 * - PATCH /api/admin/media/{media} (update)
 *
 * Note: Non-existent routes (GET /media/{id}, DELETE /media/{id}) are not tested to avoid artificial 404s.
 */
class MediaAbilityParityTest extends TestCase
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
        Storage::fake('public');
    }

    public function test_allowed_roles_can_list_media(): void
    {
        CuratorMedia::query()->create([
            'disk' => 'public',
            'directory' => 'media',
            'visibility' => 'public',
            'name' => 'sample.jpg',
            'path' => 'media/sample.jpg',
            'width' => 100,
            'height' => 100,
            'size' => 1024,
            'type' => 'image',
            'ext' => 'jpg',
            'folder' => CuratorMedia::FOLDER_GENERAL,
        ]);

        foreach (self::ALLOWED_ROLES as $role) {
            $this->actingAsRole($role);

            $response = $this->getJson('/api/admin/media');

            $response->assertOk(
                "Role '{$role}' must be permitted to list media (GET /api/admin/media)."
            );
        }
    }

    public function test_blocked_roles_cannot_list_media(): void
    {
        CuratorMedia::query()->create([
            'disk' => 'public',
            'directory' => 'media',
            'visibility' => 'public',
            'name' => 'sample.jpg',
            'path' => 'media/sample.jpg',
            'width' => 100,
            'height' => 100,
            'size' => 1024,
            'type' => 'image',
            'ext' => 'jpg',
            'folder' => CuratorMedia::FOLDER_GENERAL,
        ]);

        foreach (self::BLOCKED_ROLES as $role) {
            $this->actingAsRole($role);

            $response = $this->getJson('/api/admin/media');

            $response->assertForbidden(
                "Role '{$role}' must be forbidden from listing media (GET /api/admin/media)."
            );
        }
    }

    public function test_allowed_roles_can_create_media(): void
    {
        foreach (self::ALLOWED_ROLES as $role) {
            $this->actingAsRole($role);

            $file = UploadedFile::fake()->image("image_{$role}.jpg", 200, 200);

            $response = $this->postJson('/api/admin/media', [
                'file' => $file,
                'folder' => CuratorMedia::FOLDER_GENERAL,
            ]);

            $response->assertCreated(
                "Role '{$role}' must be permitted to upload media (POST /api/admin/media)."
            );
        }
    }

    public function test_blocked_roles_cannot_create_media(): void
    {
        foreach (self::BLOCKED_ROLES as $role) {
            $this->actingAsRole($role);

            $file = UploadedFile::fake()->image("blocked_{$role}.jpg", 200, 200);

            $response = $this->postJson('/api/admin/media', [
                'file' => $file,
                'folder' => CuratorMedia::FOLDER_GENERAL,
            ]);

            $response->assertForbidden(
                "Role '{$role}' must be forbidden from uploading media (POST /api/admin/media)."
            );
        }
    }

    public function test_allowed_roles_can_update_media(): void
    {
        $media = CuratorMedia::query()->create([
            'disk' => 'public',
            'directory' => 'media',
            'visibility' => 'public',
            'name' => 'sample_patch.jpg',
            'path' => 'media/sample_patch.jpg',
            'width' => 100,
            'height' => 100,
            'size' => 1024,
            'type' => 'image',
            'ext' => 'jpg',
            'folder' => CuratorMedia::FOLDER_GENERAL,
        ]);

        foreach (self::ALLOWED_ROLES as $role) {
            $this->actingAsRole($role);

            $response = $this->patchJson("/api/admin/media/{$media->id}", [
                'folder' => CuratorMedia::FOLDER_PRODUCT,
            ]);

            $response->assertOk(
                "Role '{$role}' must be permitted to update media (PATCH /api/admin/media/{$media->id})."
            );
        }
    }

    public function test_blocked_roles_cannot_update_media(): void
    {
        $media = CuratorMedia::query()->create([
            'disk' => 'public',
            'directory' => 'media',
            'visibility' => 'public',
            'name' => 'protected_patch.jpg',
            'path' => 'media/protected_patch.jpg',
            'width' => 100,
            'height' => 100,
            'size' => 1024,
            'type' => 'image',
            'ext' => 'jpg',
            'folder' => CuratorMedia::FOLDER_GENERAL,
        ]);

        foreach (self::BLOCKED_ROLES as $role) {
            $this->actingAsRole($role);

            $response = $this->patchJson("/api/admin/media/{$media->id}", [
                'folder' => CuratorMedia::FOLDER_PRODUCT,
            ]);

            $response->assertForbidden(
                "Role '{$role}' must be forbidden from updating media (PATCH /api/admin/media/{$media->id})."
            );
        }
    }

    public function test_migration_seeds_and_assigns_media_permissions_to_core_roles_only(): void
    {
        $migration = require database_path('migrations/2026_09_21_000004_seed_media_domain_permissions.php');
        $migration->up();

        $admin = Role::query()->where('name', 'admin')->where('guard_name', 'web')->first();
        $this->assertNotNull($admin);

        foreach (AdminAbilityRegistry::MEDIA as $permission) {
            $this->assertTrue(
                $admin->hasPermissionTo($permission),
                "Admin must have permission '{$permission}' after migration."
            );
        }

        foreach (['Product Manager', 'Order Manager', 'Support'] as $businessRole) {
            $role = Role::query()->where('name', $businessRole)->where('guard_name', 'web')->first();
            $this->assertNotNull($role);

            foreach (AdminAbilityRegistry::MEDIA as $permission) {
                $this->assertFalse(
                    $role->hasPermissionTo($permission),
                    "Business role '{$businessRole}' must NOT have permission '{$permission}'."
                );
            }
        }
    }

    public function test_unauthenticated_request_is_unauthorized_for_all_endpoints(): void
    {
        $media = CuratorMedia::query()->create([
            'disk' => 'public',
            'directory' => 'media',
            'visibility' => 'public',
            'name' => 'guest.jpg',
            'path' => 'media/guest.jpg',
            'width' => 100,
            'height' => 100,
            'size' => 1024,
            'type' => 'image',
            'ext' => 'jpg',
            'folder' => CuratorMedia::FOLDER_GENERAL,
        ]);

        $this->getJson('/api/admin/media')->assertUnauthorized();
        $this->postJson('/api/admin/media', [
            'file' => UploadedFile::fake()->image('guest.jpg', 100, 100),
            'folder' => CuratorMedia::FOLDER_GENERAL,
        ])->assertUnauthorized();
        $this->patchJson("/api/admin/media/{$media->id}", [
            'folder' => CuratorMedia::FOLDER_PRODUCT,
        ])->assertUnauthorized();
    }

    private function actingAsRole(string $role): User
    {
        $user = User::factory()->create();
        $user->assignRole($role);
        Sanctum::actingAs($user);

        return $user;
    }
}
