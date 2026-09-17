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

    public function test_secure_settings_require_authentication_and_core_admin_roles(): void
    {
        foreach (['smtp', 'ai'] as $domain) {
            $this->getJson("/api/admin/settings/{$domain}")->assertUnauthorized();
            $this->putJson("/api/admin/settings/{$domain}", [])->assertUnauthorized();
        }

        Sanctum::actingAs($this->userWithRole('Support'));
        $this->getJson('/api/admin/settings/smtp')->assertForbidden();
        $this->putJson('/api/admin/settings/ai', [])->assertForbidden();

        foreach (['super_admin', 'admin', 'staff'] as $role) {
            Sanctum::actingAs($this->userWithRole($role));
            $this->getJson('/api/admin/settings/smtp')->assertOk();
            $this->getJson('/api/admin/settings/ai')->assertOk();
        }
    }

    public function test_smtp_get_exposes_only_safe_metadata_and_effective_non_secret_values(): void
    {
        config([
            'mail.mailers.smtp.host' => 'env.smtp.test',
            'mail.mailers.smtp.port' => 2525,
            'mail.mailers.smtp.username' => 'env-user',
            'mail.mailers.smtp.password' => 'ENV-SMTP-SECRET-7391',
            'mail.mailers.smtp.scheme' => 'tls',
            'mail.from.address' => 'env@example.test',
        ]);
        Setting::query()
            ->whereIn('key', ['smtp_port', 'smtp_user', 'smtp_encryption', 'mail_from_address'])
            ->get()
            ->each->delete();
        Setting::set('smtp_host', 'db.smtp.test', 'string', 'email');
        Setting::set('smtp_pass', 'DB-SMTP-SECRET-4826', 'string', 'email');
        Sanctum::actingAs($this->userWithRole('admin'));

        $response = $this->getJson('/api/admin/settings/smtp')
            ->assertOk()
            ->assertJsonPath('data.configured', true)
            ->assertJsonPath('data.source', 'mixed')
            ->assertJsonPath('data.fields.smtp_host.value', 'db.smtp.test')
            ->assertJsonPath('data.fields.smtp_host.source', 'database')
            ->assertJsonPath('data.fields.smtp_port.value', 587)
            ->assertJsonPath('data.fields.smtp_port.source', 'environment')
            ->assertJsonPath('data.fields.smtp_pass.configured', true)
            ->assertJsonPath('data.fields.smtp_pass.source', 'database')
            ->assertJsonPath('data.fields.smtp_pass.hint', 'Configured in database')
            ->assertJsonMissingPath('data.fields.smtp_pass.value');

        $content = $response->getContent();
        $this->assertStringNotContainsString('DB-SMTP-SECRET-4826', $content);
        $this->assertStringNotContainsString('ENV-SMTP-SECRET-7391', $content);
        $this->assertStringNotContainsString('4826', $content);
        $this->assertStringNotContainsString('********', $content);
    }

    public function test_ai_get_exposes_all_ten_fields_without_any_secret_material(): void
    {
        config([
            'services.anthropic.key' => 'ENV-ANTHROPIC-SECRET-1111',
            'services.anthropic.model' => 'claude-env',
            'services.openai.key' => 'ENV-OPENAI-SECRET-2222',
            'services.openai.model' => 'gpt-env',
            'services.openai.base_url' => 'https://openai.env.test/v1',
            'services.xai.key' => null,
            'services.xai.model' => null,
            'services.gemini.key' => 'ENV-GEMINI-SECRET-3333',
            'services.gemini.model' => 'gemini-env',
        ]);
        Setting::set('ai_seo_provider', 'grok', 'string', 'ai');
        Setting::set('openai_api_key', 'DB-OPENAI-SECRET-4444', 'string', 'ai');
        Setting::set('xai_api_key', 'DB-XAI-SECRET-5555', 'string', 'ai');
        Sanctum::actingAs($this->userWithRole('staff'));

        $response = $this->getJson('/api/admin/settings/ai')
            ->assertOk()
            ->assertJsonPath('data.source', 'mixed')
            ->assertJsonPath('data.fields.ai_seo_provider.value', 'grok')
            ->assertJsonPath('data.fields.openai_api_key.source', 'database')
            ->assertJsonPath('data.fields.anthropic_api_key.source', 'environment')
            ->assertJsonPath('data.fields.xai_api_key.source', 'database')
            ->assertJsonPath('data.fields.gemini_api_key.source', 'environment')
            ->assertJsonPath('data.fields.xai_model.source', 'none');

        $this->assertSame([
            'ai_seo_provider',
            'anthropic_api_key',
            'anthropic_model',
            'openai_api_key',
            'openai_model',
            'openai_base_url',
            'xai_api_key',
            'xai_model',
            'gemini_api_key',
            'gemini_model',
        ], array_keys($response->json('data.fields')));

        foreach (['anthropic_api_key', 'openai_api_key', 'xai_api_key', 'gemini_api_key'] as $key) {
            $response->assertJsonMissingPath("data.fields.{$key}.value");
        }
        foreach (['1111', '2222', '3333', '4444', '5555', '********'] as $forbidden) {
            $this->assertStringNotContainsString($forbidden, $response->getContent());
        }
    }

    public function test_secure_update_preserves_omitted_and_empty_values_and_replaces_non_empty_candidates(): void
    {
        Setting::set('smtp_pass', 'existing-smtp-secret', 'string', 'email');
        Setting::set('smtp_host', 'existing.smtp.test', 'string', 'email');
        Setting::set('openai_api_key', 'existing-openai-secret', 'string', 'ai');
        Sanctum::actingAs($this->userWithRole('admin'));

        $this->putJson('/api/admin/settings/smtp', [
            'fields' => ['smtp_host' => 'updated.smtp.test'],
        ])->assertOk()->assertJsonMissingPath('data.fields.smtp_pass.value');
        $this->assertSame('existing-smtp-secret', Setting::get('smtp_pass'));

        $this->putJson('/api/admin/settings/smtp', [
            'fields' => ['smtp_pass' => '   '],
        ])->assertOk();
        $this->assertSame('existing-smtp-secret', Setting::get('smtp_pass'));

        $response = $this->putJson('/api/admin/settings/ai', [
            'fields' => ['openai_api_key' => 'replacement-openai-secret'],
        ])->assertOk()->assertJsonPath('data.fields.openai_api_key.source', 'database');

        $this->assertSame('replacement-openai-secret', Setting::get('openai_api_key'));
        $this->assertStringNotContainsString('replacement-openai-secret', $response->getContent());
    }

    public function test_secure_update_clear_removes_database_override_and_reveals_environment_source(): void
    {
        config([
            'mail.mailers.smtp.password' => 'environment-smtp-secret',
            'services.openai.key' => 'environment-openai-secret',
        ]);
        Setting::set('smtp_pass', 'database-smtp-secret', 'string', 'email');
        Setting::set('openai_api_key', 'database-openai-secret', 'string', 'ai');
        Sanctum::actingAs($this->userWithRole('super_admin'));

        $smtp = $this->putJson('/api/admin/settings/smtp', [
            'clear_fields' => ['smtp_pass'],
        ])->assertOk()->assertJsonPath('data.fields.smtp_pass.source', 'environment');
        $ai = $this->putJson('/api/admin/settings/ai', [
            'clear_fields' => ['openai_api_key'],
        ])->assertOk()->assertJsonPath('data.fields.openai_api_key.source', 'environment');

        $this->assertDatabaseMissing('settings', ['key' => 'smtp_pass']);
        $this->assertDatabaseMissing('settings', ['key' => 'openai_api_key']);
        foreach (['environment-smtp-secret', 'database-smtp-secret'] as $secret) {
            $this->assertStringNotContainsString($secret, $smtp->getContent());
        }
        foreach (['environment-openai-secret', 'database-openai-secret'] as $secret) {
            $this->assertStringNotContainsString($secret, $ai->getContent());
        }
    }

    public function test_secure_update_rejects_conflicts_arbitrary_fields_and_invalid_provider(): void
    {
        Sanctum::actingAs($this->userWithRole('admin'));

        $this->putJson('/api/admin/settings/smtp', [
            'fields' => ['smtp_pass' => 'replacement'],
            'clear_fields' => ['smtp_pass'],
        ])->assertUnprocessable()->assertJsonValidationErrors('fields.smtp_pass');

        $this->putJson('/api/admin/settings/smtp', [
            'fields' => ['openai_api_key' => 'cross-domain'],
        ])->assertUnprocessable()->assertJsonValidationErrors('fields');

        $this->putJson('/api/admin/settings/ai', [
            'fields' => ['smtp_pass' => 'cross-domain'],
        ])->assertUnprocessable()->assertJsonValidationErrors('fields');

        $this->putJson('/api/admin/settings/ai', [
            'fields' => ['ai_seo_provider' => 'xai'],
        ])->assertUnprocessable()->assertJsonValidationErrors('fields.ai_seo_provider');

        foreach (['auto', 'anthropic', 'openai', 'grok', 'gemini'] as $provider) {
            $this->putJson('/api/admin/settings/ai', [
                'fields' => ['ai_seo_provider' => $provider],
            ])->assertOk()->assertJsonPath('data.fields.ai_seo_provider.value', $provider);
        }
    }

    public function test_secure_metadata_reports_none_when_no_database_or_environment_values_exist(): void
    {
        config([
            'services.anthropic.key' => null,
            'services.anthropic.model' => null,
            'services.openai.key' => null,
            'services.openai.model' => null,
            'services.openai.base_url' => null,
            'services.xai.key' => null,
            'services.xai.model' => null,
            'services.gemini.key' => null,
            'services.gemini.model' => null,
        ]);
        Sanctum::actingAs($this->userWithRole('admin'));

        $this->getJson('/api/admin/settings/ai')
            ->assertOk()
            ->assertJsonPath('data.fields.ai_seo_provider.value', 'auto')
            ->assertJsonPath('data.fields.openai_api_key.configured', false)
            ->assertJsonPath('data.fields.openai_api_key.source', 'none')
            ->assertJsonPath('data.fields.openai_api_key.hint', 'Not configured');
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
