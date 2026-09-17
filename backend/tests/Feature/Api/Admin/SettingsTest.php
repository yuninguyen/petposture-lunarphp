<?php

namespace Tests\Feature\Api\Admin;

use App\Models\CuratorMedia;
use App\Models\Setting;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class SettingsTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(RoleSeeder::class);

        foreach (['super_admin', 'admin', 'staff', 'Product Manager', 'Order Manager', 'Support', 'customer', 'unknown'] as $role) {
            Role::firstOrCreate(['name' => $role, 'guard_name' => 'web']);
        }
    }

    public function test_non_secret_settings_require_authentication(): void
    {
        foreach (['general', 'branding', 'analytics'] as $domain) {
            $this->getJson("/api/admin/settings/{$domain}")->assertUnauthorized();
            $this->putJson("/api/admin/settings/{$domain}", [])->assertUnauthorized();
        }
    }

    public function test_only_core_admin_roles_can_access_non_secret_settings(): void
    {
        foreach (['customer', 'Product Manager', 'Order Manager', 'Support', 'unknown'] as $role) {
            Sanctum::actingAs($this->userWithRole($role));
            $this->getJson('/api/admin/settings/general')->assertForbidden();
            $this->putJson('/api/admin/settings/general', ['shop_name' => 'Blocked'])->assertForbidden();
        }

        Sanctum::actingAs(User::factory()->create());
        $this->getJson('/api/admin/settings/general')->assertForbidden();
        $this->putJson('/api/admin/settings/general', ['shop_name' => 'Blocked'])->assertForbidden();

        foreach (['super_admin', 'admin', 'staff'] as $role) {
            Sanctum::actingAs($this->userWithRole($role));
            $this->getJson('/api/admin/settings/general')->assertOk();
        }
    }

    public function test_each_domain_returns_only_its_allowlisted_values(): void
    {
        Setting::set('shop_name', 'PetPosture', 'string', 'general');
        Setting::set('shop_description', 'Healthy pets', 'string', 'general');
        Setting::set('admin_logo', 'settings/admin-logo.png', 'string', 'admin');
        Setting::set('google_analytics_id', 'G-TEST', 'string', 'general');
        Setting::set('smtp_pass', 'must-not-appear', 'string', 'smtp');

        Sanctum::actingAs($this->userWithRole('admin'));

        $this->getJson('/api/admin/settings/general')
            ->assertOk()
            ->assertExactJson(['data' => [
                'shop_name' => 'PetPosture',
                'shop_logo' => null,
                'shop_favicon' => null,
                'shop_description' => 'Healthy pets',
            ]]);

        $this->getJson('/api/admin/settings/branding')
            ->assertOk()
            ->assertJsonPath('data.admin_logo.id', null)
            ->assertJsonPath('data.admin_logo.url', asset('storage/settings/admin-logo.png'))
            ->assertJsonMissingPath('data.shop_name')
            ->assertJsonMissingPath('data.smtp_pass');

        $this->getJson('/api/admin/settings/analytics')
            ->assertOk()
            ->assertExactJson(['data' => ['google_analytics_id' => 'G-TEST']]);
    }

    public function test_media_id_is_resolved_to_curator_path_and_returned_with_string_id(): void
    {
        $media = $this->createMedia('media/general/storefront-logo.png');
        Sanctum::actingAs($this->userWithRole('admin'));

        $this->putJson('/api/admin/settings/general', [
            'shop_logo' => ['media_id' => (string) $media->id],
        ])
            ->assertOk()
            ->assertJsonPath('data.shop_logo.id', (string) $media->id)
            ->assertJsonPath('data.shop_logo.url', asset('storage/'.$media->path));

        $this->assertSame($media->path, Setting::get('shop_logo'));
        $this->assertNotSame((string) $media->id, Setting::get('shop_logo'));
    }

    public function test_legacy_media_preview_has_null_id_and_get_has_no_side_effects(): void
    {
        Setting::set('shop_logo', 'settings/legacy-logo.png', 'string', 'general');
        $before = CuratorMedia::count();
        Sanctum::actingAs($this->userWithRole('staff'));

        $this->getJson('/api/admin/settings/general')
            ->assertOk()
            ->assertJsonPath('data.shop_logo.id', null)
            ->assertJsonPath('data.shop_logo.url', asset('storage/settings/legacy-logo.png'));

        $this->assertSame($before, CuratorMedia::count());
    }

    public function test_explicit_null_removes_media_setting_and_omitted_fields_remain_unchanged(): void
    {
        Setting::set('shop_name', 'Keep Me', 'string', 'general');
        Setting::set('shop_logo', 'settings/remove-me.png', 'string', 'general');
        Sanctum::actingAs($this->userWithRole('super_admin'));

        $this->putJson('/api/admin/settings/general', ['shop_logo' => null])
            ->assertOk()
            ->assertJsonPath('data.shop_logo', null)
            ->assertJsonPath('data.shop_name', 'Keep Me');

        $this->assertDatabaseMissing('settings', ['key' => 'shop_logo']);
        $this->assertSame('Keep Me', Setting::get('shop_name'));
    }

    public function test_updates_are_allowlisted_and_return_refreshed_domain_state(): void
    {
        Sanctum::actingAs($this->userWithRole('admin'));

        $this->putJson('/api/admin/settings/general', [
            'shop_name' => 'Updated Shop',
            'shop_description' => 'Updated description',
            'smtp_pass' => 'not-allowed',
        ])->assertUnprocessable()->assertJsonValidationErrors('smtp_pass');

        $this->putJson('/api/admin/settings/analytics', [
            'google_analytics_id' => 'G-UPDATED',
        ])
            ->assertOk()
            ->assertExactJson(['data' => ['google_analytics_id' => 'G-UPDATED']]);

        $this->assertSame('G-UPDATED', Setting::get('google_analytics_id'));
    }

    public function test_branding_update_persists_media_path_and_nullable_text_removes_setting(): void
    {
        $media = $this->createMedia('media/general/admin-logo.png');
        Setting::set('shop_description', 'Remove this', 'string', 'general');
        Sanctum::actingAs($this->userWithRole('admin'));

        $this->putJson('/api/admin/settings/branding', [
            'admin_logo' => ['media_id' => (string) $media->id],
        ])
            ->assertOk()
            ->assertJsonPath('data.admin_logo.id', (string) $media->id);

        $this->assertSame($media->path, Setting::get('admin_logo'));

        $this->putJson('/api/admin/settings/general', ['shop_description' => null])
            ->assertOk()
            ->assertJsonPath('data.shop_description', null);

        $this->assertDatabaseMissing('settings', ['key' => 'shop_description']);
    }

    public function test_media_id_must_exist(): void
    {
        Sanctum::actingAs($this->userWithRole('admin'));

        $this->putJson('/api/admin/settings/branding', [
            'admin_logo' => ['media_id' => '999999'],
        ])->assertUnprocessable()->assertJsonValidationErrors('admin_logo.media_id');
    }

    public function test_present_non_null_media_requires_a_non_null_media_id_for_all_media_fields(): void
    {
        Sanctum::actingAs($this->userWithRole('admin'));

        foreach ([
            ['/api/admin/settings/general', 'shop_logo'],
            ['/api/admin/settings/general', 'shop_favicon'],
            ['/api/admin/settings/branding', 'admin_logo'],
            ['/api/admin/settings/branding', 'admin_favicon'],
        ] as [$endpoint, $field]) {
            foreach ([[], ['media_id' => null]] as $malformedMedia) {
                $this->putJson($endpoint, [$field => $malformedMedia])
                    ->assertUnprocessable()
                    ->assertJsonValidationErrors("{$field}.media_id");
            }
        }
    }

    public function test_shop_name_cannot_be_null(): void
    {
        Sanctum::actingAs($this->userWithRole('admin'));

        $this->putJson('/api/admin/settings/general', ['shop_name' => null])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('shop_name');
    }

    private function createMedia(string $path): CuratorMedia
    {
        $media = new CuratorMedia;
        $media->forceFill([
            'disk' => 'public',
            'directory' => 'media/general',
            'visibility' => 'public',
            'name' => 'storefront-logo',
            'path' => $path,
            'type' => 'image',
            'ext' => 'png',
        ]);
        $media->save();

        return $media;
    }

    private function userWithRole(string $role): User
    {
        $user = User::factory()->create();
        $user->assignRole($role);

        return $user;
    }
}
