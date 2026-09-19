<?php

declare(strict_types=1);

namespace Tests\Feature\Api\Admin;

use App\Models\Setting;
use App\Models\User;
use App\Security\AdminAbilityRegistry;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

/**
 * Parity test suite for Phase 6b: SEO & Social Domain Migration.
 *
 * Verifies exact 100% status code parity across all 7 roles for the SEO & Social endpoints:
 * - GET /api/admin/seo-social (view_seo_social)
 * - POST /api/admin/seo-social (update_seo_social)
 */
class SeoSocialAbilityParityTest extends TestCase
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

    public function test_allowed_roles_can_get_seo_social_settings(): void
    {
        Setting::query()->create([
            'key' => 'social_facebook',
            'value' => 'https://facebook.com/petposture',
            'type' => 'string',
            'group' => 'seo_social',
        ]);

        foreach (self::ALLOWED_ROLES as $role) {
            $this->actingAsRole($role);

            $response = $this->getJson('/api/admin/seo-social');

            $response->assertOk(
                "Role '{$role}' must be permitted to get SEO & Social settings (GET /api/admin/seo-social)."
            );
            $response->assertJsonPath('social_facebook', 'https://facebook.com/petposture');
        }
    }

    public function test_blocked_roles_cannot_get_seo_social_settings(): void
    {
        Setting::query()->create([
            'key' => 'social_facebook',
            'value' => 'https://facebook.com/petposture',
            'type' => 'string',
            'group' => 'seo_social',
        ]);

        foreach (self::BLOCKED_ROLES as $role) {
            $this->actingAsRole($role);

            $response = $this->getJson('/api/admin/seo-social');

            $response->assertForbidden(
                "Role '{$role}' must be forbidden from getting SEO & Social settings (GET /api/admin/seo-social)."
            );
        }
    }

    public function test_allowed_roles_can_update_seo_social_settings(): void
    {
        foreach (self::ALLOWED_ROLES as $role) {
            $this->actingAsRole($role);

            $phone = "+1234567-{$role}";
            $response = $this->postJson('/api/admin/seo-social', [
                'business_phone' => $phone,
                'social_facebook' => 'https://facebook.com/petposture',
            ]);

            $response->assertOk(
                "Role '{$role}' must be permitted to update SEO & Social settings (POST /api/admin/seo-social)."
            );

            $this->assertDatabaseHas('settings', [
                'key' => 'business_phone',
                'value' => $phone,
            ]);
        }
    }

    public function test_blocked_roles_cannot_update_seo_social_settings(): void
    {
        foreach (self::BLOCKED_ROLES as $role) {
            $this->actingAsRole($role);

            $response = $this->postJson('/api/admin/seo-social', [
                'business_phone' => "+999999-{$role}",
            ]);

            $response->assertForbidden(
                "Role '{$role}' must be forbidden from updating SEO & Social settings (POST /api/admin/seo-social)."
            );

            $this->assertDatabaseMissing('settings', [
                'value' => "+999999-{$role}",
            ]);
        }
    }

    public function test_migration_seeds_and_assigns_seo_social_permissions_to_core_roles_only(): void
    {
        $migration = require database_path('migrations/2026_09_21_000005_seed_seo_social_domain_permissions.php');
        $migration->up();

        $admin = Role::query()->where('name', 'admin')->where('guard_name', 'web')->first();
        $this->assertNotNull($admin);

        foreach (AdminAbilityRegistry::SEO_SOCIAL as $permission) {
            $this->assertTrue(
                $admin->hasPermissionTo($permission),
                "Admin must have permission '{$permission}' after migration."
            );
        }

        foreach (['Product Manager', 'Order Manager', 'Support'] as $businessRole) {
            $role = Role::query()->where('name', $businessRole)->where('guard_name', 'web')->first();
            $this->assertNotNull($role);

            foreach (AdminAbilityRegistry::SEO_SOCIAL as $permission) {
                $this->assertFalse(
                    $role->hasPermissionTo($permission),
                    "Business role '{$businessRole}' must NOT have permission '{$permission}'."
                );
            }
        }
    }

    public function test_unauthenticated_request_is_unauthorized_for_all_endpoints(): void
    {
        $this->getJson('/api/admin/seo-social')->assertUnauthorized();
        $this->postJson('/api/admin/seo-social', [
            'business_phone' => '+10000000',
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
