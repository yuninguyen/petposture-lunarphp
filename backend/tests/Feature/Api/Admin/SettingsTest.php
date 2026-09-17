<?php

namespace Tests\Feature\Api\Admin;

use App\Models\CuratorMedia;
use App\Models\Setting;
use App\Models\User;
use App\Services\Admin\SecureSettingsService;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Log\Events\MessageLogged;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Role;
use Symfony\Component\Mailer\Exception\TransportException;
use Symfony\Component\Mailer\Exception\UnexpectedResponseException;
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

    public function test_secure_settings_require_authentication_and_full_core_admin_role_matrix(): void
    {
        foreach (['smtp', 'ai'] as $domain) {
            $this->getJson("/api/admin/settings/{$domain}")->assertUnauthorized();
            $this->putJson("/api/admin/settings/{$domain}", [])->assertUnauthorized();
        }

        foreach (['customer', 'Product Manager', 'Order Manager', 'Support', 'unknown'] as $role) {
            Sanctum::actingAs($this->userWithRole($role));
            foreach (['smtp', 'ai'] as $domain) {
                $this->getJson("/api/admin/settings/{$domain}")->assertForbidden();
                $this->putJson("/api/admin/settings/{$domain}", [])->assertForbidden();
            }
        }

        Sanctum::actingAs(User::factory()->create());
        foreach (['smtp', 'ai'] as $domain) {
            $this->getJson("/api/admin/settings/{$domain}")->assertForbidden();
            $this->putJson("/api/admin/settings/{$domain}", [])->assertForbidden();
        }

        foreach (['super_admin', 'admin', 'staff'] as $role) {
            Sanctum::actingAs($this->userWithRole($role));
            foreach (['smtp', 'ai'] as $domain) {
                $this->getJson("/api/admin/settings/{$domain}")->assertOk();
                $this->putJson("/api/admin/settings/{$domain}", [])->assertOk();
            }
        }
    }

    public function test_smtp_get_uses_stable_bootstrap_fallbacks_after_live_mail_config_is_mutated(): void
    {
        config([
            'mail.environment.smtp.host' => 'env.smtp.test',
            'mail.environment.smtp.port' => 2525,
            'mail.environment.smtp.username' => 'env-user',
            'mail.environment.smtp.password' => 'ENV-SMTP-SECRET-STABLE',
            'mail.environment.smtp.scheme' => 'tls',
            'mail.environment.from.address' => 'env@example.test',
            'mail.mailers.smtp.host' => 'database-mutated.smtp.test',
            'mail.mailers.smtp.port' => 587,
            'mail.mailers.smtp.username' => 'database-mutated-user',
            'mail.mailers.smtp.password' => 'DATABASE-MUTATED-SECRET',
            'mail.mailers.smtp.scheme' => 'ssl',
            'mail.from.address' => 'database-mutated@example.test',
        ]);
        Setting::query()->whereIn('key', [
            'smtp_host', 'smtp_port', 'smtp_user', 'smtp_pass', 'smtp_encryption', 'mail_from_address',
        ])->delete();
        Sanctum::actingAs($this->userWithRole('admin'));

        $response = $this->getJson('/api/admin/settings/smtp')
            ->assertOk()
            ->assertJsonPath('data.fields.smtp_host.value', 'env.smtp.test')
            ->assertJsonPath('data.fields.smtp_port.value', 2525)
            ->assertJsonPath('data.fields.smtp_user.value', 'env-user')
            ->assertJsonPath('data.fields.smtp_encryption.value', 'tls')
            ->assertJsonPath('data.fields.mail_from_address.value', 'env@example.test')
            ->assertJsonPath('data.fields.smtp_pass.source', 'environment');

        foreach (['ENV-SMTP-SECRET-STABLE', 'DATABASE-MUTATED-SECRET'] as $secret) {
            $this->assertStringNotContainsString($secret, $response->getContent());
        }
    }

    public function test_smtp_get_exposes_only_safe_metadata_and_effective_non_secret_values(): void
    {
        config([
            'mail.environment.smtp.host' => 'env.smtp.test',
            'mail.environment.smtp.port' => 2525,
            'mail.environment.smtp.username' => 'env-user',
            'mail.environment.smtp.password' => 'ENV-SMTP-SECRET-7391',
            'mail.environment.smtp.scheme' => 'tls',
            'mail.environment.from.address' => 'env@example.test',
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
            ->assertJsonPath('data.fields.smtp_port.value', 2525)
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
            'mail.environment.smtp.password' => 'environment-smtp-secret',
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
            'fields' => ['smtp_port' => 2525],
            'clear_fields' => ['smtp_port'],
        ])->assertUnprocessable()->assertJsonValidationErrors('fields.smtp_port');

        $this->putJson('/api/admin/settings/smtp', [
            'fields' => ['openai_api_key' => 'cross-domain'],
        ])->assertUnprocessable()->assertJsonValidationErrors('fields');

        $this->putJson('/api/admin/settings/ai', [
            'fields' => ['smtp_pass' => 'cross-domain'],
        ])->assertUnprocessable()->assertJsonValidationErrors('fields');

        foreach (['smtp', 'ai'] as $domain) {
            $this->putJson("/api/admin/settings/{$domain}", [
                'fields' => [],
                'clear_fields' => [],
                'unexpected' => 'strictly-rejected',
            ])->assertUnprocessable()->assertJsonValidationErrors('unexpected');
        }

        $this->putJson('/api/admin/settings/ai', [
            'fields' => ['ai_seo_provider' => 'xai'],
        ])->assertUnprocessable()->assertJsonValidationErrors('fields.ai_seo_provider');

        foreach (['auto', 'anthropic', 'openai', 'grok', 'gemini'] as $provider) {
            $this->putJson('/api/admin/settings/ai', [
                'fields' => ['ai_seo_provider' => $provider],
            ])->assertOk()->assertJsonPath('data.fields.ai_seo_provider.value', $provider);
        }
    }

    public function test_secure_metadata_reports_default_anthropic_model_without_marking_it_configured(): void
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
            ->assertJsonPath('data.fields.anthropic_model.value', 'claude-sonnet-5')
            ->assertJsonPath('data.fields.anthropic_model.configured', false)
            ->assertJsonPath('data.fields.anthropic_model.source', 'none')
            ->assertJsonPath('data.fields.openai_api_key.configured', false)
            ->assertJsonPath('data.fields.openai_api_key.source', 'none')
            ->assertJsonPath('data.fields.openai_api_key.hint', 'Not configured');
    }

    public function test_secure_secret_candidates_are_absent_from_captured_logs_and_cache(): void
    {
        $smtpSecret = 'SMTP-CANDIDATE-LOG-CACHE-SENTINEL';
        $aiSecret = 'AI-CANDIDATE-LOG-CACHE-SENTINEL';
        $messages = [];
        Log::listen(function (MessageLogged $event) use (&$messages): void {
            $messages[] = $event->message.' '.json_encode($event->context);
        });
        Sanctum::actingAs($this->userWithRole('admin'));

        $this->putJson('/api/admin/settings/smtp', [
            'fields' => ['smtp_pass' => $smtpSecret],
        ])->assertOk();
        $this->putJson('/api/admin/settings/ai', [
            'fields' => ['openai_api_key' => $aiSecret],
        ])->assertOk();

        $logged = implode("\n", $messages);
        $this->assertStringNotContainsString($smtpSecret, $logged);
        $this->assertStringNotContainsString($aiSecret, $logged);

        foreach (Cache::get('setting:smtp_pass', []) as $cached) {
            $this->assertNotSame($smtpSecret, $cached);
        }
        foreach (Cache::get('setting:openai_api_key', []) as $cached) {
            $this->assertNotSame($aiSecret, $cached);
        }
    }

    public function test_smtp_test_requires_authentication_and_core_admin_role(): void
    {
        $this->postJson('/api/admin/settings/smtp/test', [])->assertUnauthorized();

        foreach (['customer', 'Product Manager', 'Order Manager', 'Support', 'unknown'] as $role) {
            Sanctum::actingAs($this->userWithRole($role));
            $this->postJson('/api/admin/settings/smtp/test', [])->assertForbidden();
        }

        Sanctum::actingAs(User::factory()->create());
        $this->postJson('/api/admin/settings/smtp/test', [])->assertForbidden();

        $sent = [];
        $this->capturingSmtpService($sent);
        Sanctum::actingAs($this->userWithRole('super_admin'));
        $this->postJson('/api/admin/settings/smtp/test', [
            'fields' => [
                'smtp_host' => 'super-admin.smtp.test',
                'smtp_port' => 2525,
                'smtp_encryption' => 'tls',
                'mail_from_address' => 'super-admin@example.test',
            ],
        ])->assertOk();
    }

    public function test_smtp_test_resolves_candidates_then_database_then_stable_environment_and_uses_authenticated_recipient(): void
    {
        config([
            'mail.environment.smtp.host' => 'env.smtp.test',
            'mail.environment.smtp.port' => 2525,
            'mail.environment.smtp.username' => 'env-user',
            'mail.environment.smtp.password' => 'ENV-SMTP-SECRET',
            'mail.environment.smtp.scheme' => 'tls',
            'mail.environment.from.address' => 'env@example.test',
            'mail.mailers.smtp.host' => 'mutated-live.smtp.test',
            'mail.from.address' => 'mutated-live@example.test',
        ]);
        Setting::set('smtp_port', 587, 'int', 'email');
        Setting::set('smtp_user', 'db-user', 'string', 'email');
        Setting::set('smtp_pass', 'DB-SMTP-SECRET', 'string', 'email');
        Setting::set('smtp_encryption', 'ssl', 'string', 'email');

        $sent = [];
        $this->capturingSmtpService($sent);
        $admin = $this->userWithRole('admin');
        Sanctum::actingAs($admin);

        $response = $this->postJson('/api/admin/settings/smtp/test', [
            'fields' => [
                'smtp_host' => 'candidate.smtp.test',
                'smtp_user' => '   ',
                'smtp_pass' => 'CANDIDATE-SMTP-SECRET',
                'mail_from_address' => 'candidate@example.test',
            ],
        ])->assertOk()
            ->assertExactJson(['data' => [
                'status' => 'sent',
                'message' => 'SMTP test email sent.',
            ]]);

        $this->assertSame([
            'smtp_host' => 'candidate.smtp.test',
            'smtp_port' => 587,
            'smtp_user' => 'db-user',
            'smtp_pass' => 'CANDIDATE-SMTP-SECRET',
            'smtp_encryption' => 'ssl',
            'mail_from_address' => 'candidate@example.test',
        ], $sent['configuration']);
        $this->assertSame($admin->email, $sent['recipient']);

        foreach (['CANDIDATE-SMTP-SECRET', 'DB-SMTP-SECRET', 'ENV-SMTP-SECRET'] as $secret) {
            $this->assertStringNotContainsString($secret, $response->getContent());
        }
    }

    public function test_smtp_test_clear_fields_skip_database_and_fall_back_to_stable_environment_without_persisting(): void
    {
        config([
            'mail.environment.smtp.host' => 'env.smtp.test',
            'mail.environment.smtp.port' => 2525,
            'mail.environment.smtp.username' => 'env-user',
            'mail.environment.smtp.password' => 'ENV-SMTP-SECRET',
            'mail.environment.smtp.scheme' => 'none',
            'mail.environment.from.address' => 'env@example.test',
        ]);
        foreach ([
            'smtp_host' => 'db.smtp.test',
            'smtp_port' => 465,
            'smtp_user' => 'db-user',
            'smtp_pass' => 'DB-SMTP-SECRET',
            'smtp_encryption' => 'ssl',
            'mail_from_address' => 'db@example.test',
        ] as $key => $value) {
            Setting::set($key, $value, $key === 'smtp_port' ? 'int' : 'string', 'email');
        }
        Cache::put('smtp-test-unrelated', 'keep');

        $before = Setting::query()->whereIn('key', (new SecureSettingsService)->smtpFieldNames())
            ->pluck('value', 'key')->all();
        $sent = [];
        $this->capturingSmtpService($sent);
        Sanctum::actingAs($this->userWithRole('staff'));

        $this->postJson('/api/admin/settings/smtp/test', [
            'clear_fields' => (new SecureSettingsService)->smtpFieldNames(),
        ])->assertOk();

        $this->assertSame([
            'smtp_host' => 'env.smtp.test',
            'smtp_port' => 2525,
            'smtp_user' => 'env-user',
            'smtp_pass' => 'ENV-SMTP-SECRET',
            'smtp_encryption' => 'none',
            'mail_from_address' => 'env@example.test',
        ], $sent['configuration']);
        $this->assertSame($before, Setting::query()->whereIn('key', (new SecureSettingsService)->smtpFieldNames())
            ->pluck('value', 'key')->all());
        $this->assertSame('keep', Cache::get('smtp-test-unrelated'));
    }

    public function test_smtp_test_strictly_rejects_recipient_abuse_unknown_fields_and_clear_conflicts(): void
    {
        Sanctum::actingAs($this->userWithRole('admin'));

        $this->postJson('/api/admin/settings/smtp/test', [
            'recipient' => 'attacker@example.test',
        ])->assertUnprocessable()->assertJsonValidationErrors('recipient');

        $this->postJson('/api/admin/settings/smtp/test', [
            'fields' => ['recipient' => 'attacker@example.test'],
        ])->assertUnprocessable()->assertJsonValidationErrors('fields');

        $this->postJson('/api/admin/settings/smtp/test', [
            'fields' => ['smtp_pass' => 'replacement'],
            'clear_fields' => ['smtp_pass'],
        ])->assertUnprocessable()->assertJsonValidationErrors('fields.smtp_pass');

        $this->postJson('/api/admin/settings/smtp/test', [
            'clear_fields' => ['openai_api_key'],
        ])->assertUnprocessable()->assertJsonValidationErrors('clear_fields.0');
    }

    public function test_smtp_test_returns_sanitized_422_when_effective_configuration_is_incomplete(): void
    {
        config([
            'mail.environment.smtp.host' => null,
            'mail.environment.from.address' => null,
        ]);
        Setting::query()->whereIn('key', ['smtp_host', 'mail_from_address'])->get()->each->delete();
        Sanctum::actingAs($this->userWithRole('admin'));

        $this->postJson('/api/admin/settings/smtp/test', [
            'clear_fields' => ['smtp_host', 'mail_from_address'],
        ])->assertStatus(422)->assertExactJson(['data' => [
            'status' => 'invalid',
            'message' => 'The effective SMTP configuration is invalid.',
        ]]);
    }

    public function test_smtp_test_rejects_invalid_resolved_database_and_environment_configuration_before_transport(): void
    {
        $invalidConfigurations = [
            'blank host' => ['smtp_host', '   ', 'string'],
            'oversized host' => ['smtp_host', str_repeat('h', 256), 'string'],
            'lossy decimal port' => ['smtp_port', '25.5', 'string'],
            'out of range port' => ['smtp_port', '65536', 'string'],
            'non string username' => ['smtp_user', ['unexpected'], 'json'],
            'oversized password' => ['smtp_pass', str_repeat('s', 4097), 'string'],
            'invalid encryption' => ['smtp_encryption', 'starttls', 'string'],
            'invalid from address' => ['mail_from_address', 'not-an-email', 'string'],
            'oversized from address' => ['mail_from_address', str_repeat('a', 244).'@example.test', 'string'],
        ];

        foreach ($invalidConfigurations as $case => [$field, $value, $type]) {
            Setting::query()->whereIn('key', (new SecureSettingsService)->smtpFieldNames())->get()->each->delete();
            config([
                'mail.environment.smtp.host' => 'env.smtp.test',
                'mail.environment.smtp.port' => 2525,
                'mail.environment.smtp.username' => null,
                'mail.environment.smtp.password' => null,
                'mail.environment.smtp.scheme' => 'tls',
                'mail.environment.from.address' => 'env@example.test',
            ]);
            Setting::set($field, $value, $type, 'email');

            $sent = [];
            $this->capturingSmtpService($sent);
            Sanctum::actingAs($this->userWithRole('admin'));

            $this->postJson('/api/admin/settings/smtp/test', [])
                ->assertStatus(422)
                ->assertExactJson(['data' => [
                    'status' => 'invalid',
                    'message' => 'The effective SMTP configuration is invalid.',
                ]]);

            $this->assertSame([], $sent, $case);
        }
    }

    public function test_smtp_test_classifies_recognized_protocol_rejections_as_sanitized_422(): void
    {
        foreach ([535, 550] as $responseCode) {
            $candidate = 'SMTP-PROTOCOL-REJECTION-SENTINEL-'.$responseCode;
            $messages = [];
            Log::listen(function (MessageLogged $event) use (&$messages): void {
                $messages[] = $event->message.' '.json_encode($event->context);
            });
            $sent = [];
            $this->capturingSmtpService($sent, new UnexpectedResponseException($responseCode.' rejected '.$candidate, $responseCode));
            Sanctum::actingAs($this->userWithRole('admin'));

            $response = $this->postJson('/api/admin/settings/smtp/test', [
                'fields' => [
                    'smtp_host' => 'candidate.smtp.test',
                    'smtp_port' => 2525,
                    'smtp_encryption' => 'tls',
                    'mail_from_address' => 'candidate@example.test',
                ],
            ])->assertStatus(422)->assertExactJson(['data' => [
                'status' => 'rejected',
                'message' => 'The SMTP server rejected the test email.',
            ]]);

            $this->assertStringNotContainsString($candidate, $response->getContent());
            $this->assertStringNotContainsString($candidate, implode("\n", $messages));
        }
    }

    public function test_smtp_test_classifies_unexpected_response_without_code_as_sanitized_502(): void
    {
        $sent = [];
        $this->capturingSmtpService($sent, new UnexpectedResponseException('', 0));
        Sanctum::actingAs($this->userWithRole('admin'));

        $this->postJson('/api/admin/settings/smtp/test', [
            'fields' => [
                'smtp_host' => 'candidate.smtp.test',
                'smtp_port' => 2525,
                'smtp_encryption' => 'tls',
                'mail_from_address' => 'candidate@example.test',
            ],
        ])->assertStatus(502)->assertExactJson(['data' => [
            'status' => 'unavailable',
            'message' => 'Unable to send the SMTP test email.',
        ]]);
    }

    public function test_smtp_test_classifies_temporary_smtp_availability_response_as_sanitized_502(): void
    {
        $candidate = 'SMTP-AVAILABILITY-SENTINEL';
        $messages = [];
        Log::listen(function (MessageLogged $event) use (&$messages): void {
            $messages[] = $event->message.' '.json_encode($event->context);
        });
        $sent = [];
        $this->capturingSmtpService($sent, new UnexpectedResponseException('421 unavailable '.$candidate, 421));
        Sanctum::actingAs($this->userWithRole('admin'));

        $response = $this->postJson('/api/admin/settings/smtp/test', [
            'fields' => [
                'smtp_host' => 'candidate.smtp.test',
                'smtp_port' => 2525,
                'smtp_encryption' => 'tls',
                'mail_from_address' => 'candidate@example.test',
            ],
        ])->assertStatus(502)->assertExactJson(['data' => [
            'status' => 'unavailable',
            'message' => 'Unable to send the SMTP test email.',
        ]]);

        $this->assertStringNotContainsString($candidate, $response->getContent());
        $this->assertStringNotContainsString($candidate, implode("\n", $messages));
    }

    public function test_smtp_test_rejects_invalid_environment_only_fallback_before_transport(): void
    {
        Setting::query()->whereIn('key', (new SecureSettingsService)->smtpFieldNames())->get()->each->delete();
        config([
            'mail.environment.smtp.host' => 'env.smtp.test',
            'mail.environment.smtp.port' => 70000,
            'mail.environment.smtp.username' => null,
            'mail.environment.smtp.password' => null,
            'mail.environment.smtp.scheme' => 'tls',
            'mail.environment.from.address' => 'env@example.test',
        ]);
        $sent = [];
        $this->capturingSmtpService($sent);
        Sanctum::actingAs($this->userWithRole('admin'));

        $this->postJson('/api/admin/settings/smtp/test', [])
            ->assertStatus(422)
            ->assertExactJson(['data' => [
                'status' => 'invalid',
                'message' => 'The effective SMTP configuration is invalid.',
            ]]);

        $this->assertSame([], $sent);
    }

    public function test_smtp_test_classifies_authentication_transport_response_code_as_sanitized_422(): void
    {
        $sent = [];
        $this->capturingSmtpService($sent, new TransportException('authentication failed SECRET', 535));
        Sanctum::actingAs($this->userWithRole('admin'));

        $this->postJson('/api/admin/settings/smtp/test', [
            'fields' => [
                'smtp_host' => 'candidate.smtp.test',
                'smtp_port' => 2525,
                'smtp_encryption' => 'tls',
                'mail_from_address' => 'candidate@example.test',
            ],
        ])->assertStatus(422)->assertExactJson(['data' => [
            'status' => 'rejected',
            'message' => 'The SMTP server rejected the test email.',
        ]]);
    }

    public function test_smtp_test_returns_sanitized_502_without_leaking_exception_candidate_logs_or_cache(): void
    {
        config([
            'mail.environment.smtp.port' => 2525,
            'mail.environment.smtp.username' => null,
            'mail.environment.smtp.password' => null,
            'mail.environment.smtp.scheme' => 'tls',
        ]);
        $candidate = 'SMTP-CANDIDATE-LEAK-SENTINEL';
        $messages = [];
        Log::listen(function (MessageLogged $event) use (&$messages): void {
            $messages[] = $event->message.' '.json_encode($event->context);
        });
        $sent = [];
        $this->capturingSmtpService($sent, new TransportException('connection timed out '.$candidate));
        $admin = $this->userWithRole('admin');
        Sanctum::actingAs($admin);

        $response = $this->postJson('/api/admin/settings/smtp/test', [
            'fields' => [
                'smtp_host' => 'candidate.smtp.test',
                'smtp_pass' => $candidate,
                'mail_from_address' => 'candidate@example.test',
            ],
        ])->assertStatus(502)->assertExactJson(['data' => [
            'status' => 'unavailable',
            'message' => 'Unable to send the SMTP test email.',
        ]]);

        $this->assertStringNotContainsString($candidate, $response->getContent());
        $this->assertStringNotContainsString($candidate, implode("\n", $messages));
        $this->assertDatabaseMissing('settings', ['value' => $candidate]);
        $this->assertFalse(Cache::has('setting:smtp_pass'));
        $this->assertSame($admin->email, $sent['recipient']);
    }

    public function test_open_ai_model_fetch_requires_authentication_and_core_admin_role(): void
    {
        $this->postJson('/api/admin/settings/ai/fetch-models', [])->assertUnauthorized();

        foreach (['customer', 'Product Manager', 'Order Manager', 'Support', 'unknown'] as $role) {
            Sanctum::actingAs($this->userWithRole($role));
            $this->postJson('/api/admin/settings/ai/fetch-models', [])->assertForbidden();
        }

        Sanctum::actingAs(User::factory()->create());
        $this->postJson('/api/admin/settings/ai/fetch-models', [])->assertForbidden();

        Http::preventStrayRequests();
        Http::fake(['https://api.openai.com/v1/models' => Http::response(['data' => [['id' => 'gpt-test']]])]);

        foreach (['super_admin', 'admin', 'staff'] as $role) {
            config(['services.openai.key' => 'environment-openai-key']);
            Sanctum::actingAs($this->userWithRole($role));
            $this->postJson('/api/admin/settings/ai/fetch-models', [])->assertOk();
        }
    }

    public function test_open_ai_model_fetch_uses_candidate_url_bearer_timeout_and_returns_sorted_unique_non_empty_ids(): void
    {
        $candidate = 'OPENAI-CANDIDATE-KEY-SENTINEL';
        Http::preventStrayRequests();
        Http::fake(function ($request, array $options) use ($candidate) {
            $this->assertSame('https://proxy.example/v1/models', $request->url());
            $this->assertSame(['Bearer '.$candidate], $request->header('Authorization'));
            $this->assertSame(15, $options['timeout']);

            return Http::response(['data' => [
                ['id' => 'gpt-z'],
                ['id' => ''],
                ['id' => 'gpt-a'],
                ['id' => 'gpt-z'],
                ['id' => '   '],
                ['id' => 123],
                ['missing' => 'ignored'],
            ]]);
        });
        Sanctum::actingAs($this->userWithRole('admin'));

        $response = $this->postJson('/api/admin/settings/ai/fetch-models', [
            'fields' => [
                'openai_api_key' => $candidate,
                'openai_base_url' => 'https://proxy.example/v1/',
                'openai_model' => 'gpt-a',
            ],
        ])->assertOk()->assertExactJson(['data' => [
            'status' => 'loaded',
            'models' => ['gpt-a', 'gpt-z'],
        ]]);

        $this->assertStringNotContainsString($candidate, $response->getContent());
        Http::assertSentCount(1);
    }

    public function test_open_ai_model_fetch_resolves_candidate_then_database_then_environment_and_clear_skips_database_without_side_effects(): void
    {
        config([
            'services.openai.key' => 'ENV-OPENAI-KEY',
            'services.openai.base_url' => 'https://environment.openai.test/v1',
        ]);
        Setting::set('openai_api_key', 'DB-OPENAI-KEY', 'string', 'ai');
        Setting::set('openai_base_url', 'https://database.openai.test/v1', 'string', 'ai');
        Cache::put('openai-fetch-unrelated', 'keep');
        $before = Setting::query()->whereIn('key', ['openai_api_key', 'openai_base_url', 'openai_model'])
            ->pluck('value', 'key')->all();
        $seen = [];
        Http::preventStrayRequests();
        Http::fake(function ($request) use (&$seen) {
            $seen[] = [$request->url(), $request->header('Authorization')[0] ?? null];

            return Http::response(['data' => [['id' => 'gpt-test']]]);
        });
        Sanctum::actingAs($this->userWithRole('staff'));

        $this->postJson('/api/admin/settings/ai/fetch-models', [])->assertOk();
        $this->postJson('/api/admin/settings/ai/fetch-models', [
            'fields' => ['openai_api_key' => 'CANDIDATE-OPENAI-KEY'],
            'clear_fields' => ['openai_base_url'],
        ])->assertOk();
        $this->postJson('/api/admin/settings/ai/fetch-models', [
            'clear_fields' => ['openai_api_key', 'openai_base_url'],
        ])->assertOk();

        $this->assertSame([
            ['https://database.openai.test/v1/models', 'Bearer DB-OPENAI-KEY'],
            ['https://environment.openai.test/v1/models', 'Bearer CANDIDATE-OPENAI-KEY'],
            ['https://environment.openai.test/v1/models', 'Bearer ENV-OPENAI-KEY'],
        ], $seen);
        $this->assertSame($before, Setting::query()->whereIn('key', ['openai_api_key', 'openai_base_url', 'openai_model'])
            ->pluck('value', 'key')->all());
        $this->assertSame('keep', Cache::get('openai-fetch-unrelated'));
    }

    public function test_open_ai_model_fetch_validates_the_clear_aware_effective_model(): void
    {
        config([
            'services.openai.key' => 'ENV-OPENAI-KEY',
            'services.openai.base_url' => 'https://api.openai.com/v1',
            'services.openai.model' => null,
        ]);
        Setting::set('openai_model', 'gpt-database', 'string', 'ai');
        Http::preventStrayRequests();
        Http::fake(['https://api.openai.com/v1/models' => Http::response(['data' => [['id' => 'gpt-returned']]])]);
        Sanctum::actingAs($this->userWithRole('admin'));

        $this->postJson('/api/admin/settings/ai/fetch-models', [
            'clear_fields' => ['openai_model'],
        ])->assertOk()->assertExactJson(['data' => [
            'status' => 'loaded',
            'models' => ['gpt-returned'],
        ]]);

        config(['services.openai.model' => 'gpt-returned']);
        $this->postJson('/api/admin/settings/ai/fetch-models', [
            'clear_fields' => ['openai_model'],
        ])->assertOk()->assertExactJson(['data' => [
            'status' => 'loaded',
            'models' => ['gpt-returned'],
        ]]);

        config(['services.openai.model' => 'gpt-environment-missing']);
        $this->postJson('/api/admin/settings/ai/fetch-models', [
            'clear_fields' => ['openai_model'],
        ])->assertStatus(422)->assertExactJson(['data' => [
            'status' => 'invalid',
            'models' => [],
        ]]);

        $this->postJson('/api/admin/settings/ai/fetch-models', [
            'fields' => ['openai_model' => 'gpt-candidate-missing'],
        ])->assertStatus(422)->assertExactJson(['data' => [
            'status' => 'invalid',
            'models' => [],
        ]]);
    }

    public function test_open_ai_model_fetch_defaults_base_url_and_strictly_rejects_unknown_fields_and_clear_conflicts(): void
    {
        config(['services.openai.key' => 'ENV-OPENAI-KEY', 'services.openai.base_url' => null]);
        Http::preventStrayRequests();
        Http::fake(['https://api.openai.com/v1/models' => Http::response(['data' => [['id' => 'gpt-test']]])]);
        Sanctum::actingAs($this->userWithRole('admin'));

        $this->postJson('/api/admin/settings/ai/fetch-models', [])->assertOk();
        Http::assertSent(fn ($request): bool => $request->url() === 'https://api.openai.com/v1/models');

        $this->postJson('/api/admin/settings/ai/fetch-models', [
            'unexpected' => 'forbidden',
        ])->assertUnprocessable()->assertJsonValidationErrors('unexpected');
        $this->postJson('/api/admin/settings/ai/fetch-models', [
            'fields' => ['anthropic_api_key' => 'forbidden'],
        ])->assertUnprocessable()->assertJsonValidationErrors('fields');
        $this->postJson('/api/admin/settings/ai/fetch-models', [
            'clear_fields' => ['xai_api_key'],
        ])->assertUnprocessable()->assertJsonValidationErrors('clear_fields.0');
        $this->postJson('/api/admin/settings/ai/fetch-models', [
            'fields' => ['openai_api_key' => 'replacement'],
            'clear_fields' => ['openai_api_key'],
        ])->assertUnprocessable()->assertJsonValidationErrors('fields.openai_api_key');
    }

    public function test_open_ai_model_fetch_maps_missing_key_provider_rejection_and_invalid_lists_to_sanitized_422(): void
    {
        Sanctum::actingAs($this->userWithRole('admin'));
        config(['services.openai.key' => null, 'services.openai.base_url' => null]);
        Setting::query()->whereIn('key', ['openai_api_key', 'openai_base_url'])->get()->each->delete();

        $this->postJson('/api/admin/settings/ai/fetch-models', [])
            ->assertStatus(422)
            ->assertExactJson(['data' => [
                'status' => 'invalid',
                'models' => [],
            ]]);

        foreach ([
            Http::response(['error' => ['message' => 'RAW-PROVIDER-SECRET']], 401),
            Http::response(['data' => []]),
            Http::response(['data' => [['id' => ''], ['id' => 17]]]),
            Http::response(['unexpected' => 'shape']),
        ] as $fakeResponse) {
            config(['services.openai.key' => 'ENV-OPENAI-KEY']);
            Http::fake(fn () => $fakeResponse);

            $response = $this->postJson('/api/admin/settings/ai/fetch-models', [])
                ->assertStatus(422)
                ->assertExactJson(['data' => [
                    'status' => 'invalid',
                    'models' => [],
                ]]);
            $this->assertStringNotContainsString('RAW-PROVIDER-SECRET', $response->getContent());
            Http::fake();
        }
    }

    public function test_open_ai_model_fetch_maps_connection_and_unexpected_failures_to_sanitized_502_without_leaks_or_persistence(): void
    {
        foreach ([
            new ConnectionException('timeout OPENAI-TRANSPORT-SENTINEL'),
            new \RuntimeException('unexpected OPENAI-TRANSPORT-SENTINEL'),
        ] as $failure) {
            $candidate = 'OPENAI-CANDIDATE-LEAK-SENTINEL';
            $messages = [];
            Log::listen(function (MessageLogged $event) use (&$messages): void {
                $messages[] = $event->message.' '.json_encode($event->context);
            });
            Http::fake(fn () => throw $failure);
            Sanctum::actingAs($this->userWithRole('admin'));

            $response = $this->postJson('/api/admin/settings/ai/fetch-models', [
                'fields' => ['openai_api_key' => $candidate],
            ])->assertStatus(502)->assertExactJson(['data' => [
                'status' => 'unavailable',
                'models' => [],
            ]]);

            foreach ([$candidate, 'OPENAI-TRANSPORT-SENTINEL'] as $forbidden) {
                $this->assertStringNotContainsString($forbidden, $response->getContent());
                $this->assertStringNotContainsString($forbidden, implode("\n", $messages));
            }
            $this->assertDatabaseMissing('settings', ['value' => $candidate]);
            $this->assertFalse(Cache::has('setting:openai_api_key'));
        }
    }

    private function capturingSmtpService(array &$sent, ?\Throwable $failure = null): void
    {
        $service = new class($sent, $failure) extends SecureSettingsService
        {
            public function __construct(
                private array &$sent,
                private readonly ?\Throwable $failure,
            ) {}

            protected function sendSmtpTest(array $configuration, string $recipient): void
            {
                $this->sent = compact('configuration', 'recipient');

                if ($this->failure !== null) {
                    throw $this->failure;
                }
            }
        };
        $this->app->instance(SecureSettingsService::class, $service);
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
