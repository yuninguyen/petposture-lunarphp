<?php

namespace Tests\Feature\Filament;

use App\Filament\Pages\ManageSettings;
use App\Models\Setting;
use App\Models\User;
use App\Services\AiSeoProviders\AnthropicSeoProvider;
use App\Services\AiSeoProviders\OpenAiSeoProvider;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Livewire\Livewire;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class ManageSettingsTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        Role::firstOrCreate(['name' => 'admin', 'guard_name' => 'web']);
        $user = User::factory()->create(['is_active' => true]);
        $user->assignRole('admin');
        $this->actingAs($user);
    }

    public function test_storefront_and_admin_branding_settings_persist_separately(): void
    {
        Setting::set('shop_name', 'PetPosture', 'string', 'general');

        Livewire::test(ManageSettings::class)
            ->set('data.shop_favicon', ['settings/storefront.png'])
            ->set('data.admin_favicon', ['settings/admin/admin.png'])
            ->call('save')
            ->assertHasNoFormErrors();

        $this->assertSame('settings/storefront.png', Setting::get('shop_favicon'));
        $this->assertSame('settings/admin/admin.png', Setting::get('admin_favicon'));
    }

    public function test_ai_settings_persist_preference_and_model_without_hydrating_stored_keys(): void
    {
        Setting::set('shop_name', 'PetPosture', 'string', 'general');
        Setting::set('openai_api_key', 'stored-secret', 'string', 'ai');

        Livewire::test(ManageSettings::class)
            ->assertSet('data.openai_api_key', null)
            ->set('data.ai_seo_provider', 'openai')
            ->set('data.openai_model', 'account-approved-model')
            ->set('data.openai_api_key', 'replacement-secret')
            ->call('save')
            ->assertHasNoFormErrors();

        $this->assertSame('openai', Setting::get('ai_seo_provider'));
        $this->assertSame('account-approved-model', Setting::get('openai_model'));
        $this->assertSame('replacement-secret', Setting::get('openai_api_key'));
    }

    public function test_clearing_a_saved_openai_model_restores_the_environment_fallback(): void
    {
        config()->set('services.openai.model', 'environment-model');
        Setting::set('shop_name', 'PetPosture', 'string', 'general');
        Setting::set('openai_model', 'database-model', 'string', 'ai');

        Livewire::test(ManageSettings::class)
            ->set('data.openai_model', '')
            ->call('save')
            ->assertHasNoFormErrors();

        $this->assertNull(Setting::get('openai_model'));
        $this->assertSame('environment-model', app(OpenAiSeoProvider::class)->model());
    }

    public function test_clearing_a_saved_anthropic_model_restores_the_approved_default(): void
    {
        config()->set('services.anthropic.model', '');
        Setting::set('shop_name', 'PetPosture', 'string', 'general');
        Setting::set('anthropic_model', 'database-model', 'string', 'ai');

        Livewire::test(ManageSettings::class)
            ->set('data.anthropic_model', '')
            ->call('save')
            ->assertHasNoFormErrors();

        $this->assertNull(Setting::get('anthropic_model'));
        $this->assertSame('claude-sonnet-5', app(AnthropicSeoProvider::class)->model());
    }
}
