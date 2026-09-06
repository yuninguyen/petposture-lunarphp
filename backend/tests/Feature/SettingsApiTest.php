<?php

namespace Tests\Feature;

use App\Models\Setting;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Tests\TestCase;

class SettingsApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_settings_expose_storefront_and_admin_branding_urls(): void
    {
        config([
            'app.url' => 'https://api.petposture.com',
            'app.asset_url' => 'https://api.petposture.com',
        ]);

        Setting::set('shop_logo', 'settings/storefront-logo.png', 'string', 'general');
        Setting::set('shop_favicon', 'settings/storefront-favicon.png', 'string', 'general');
        Setting::set('admin_logo', 'settings/admin-logo.png', 'string', 'admin');
        Setting::set('admin_favicon', 'settings/admin-favicon.png', 'string', 'admin');

        $this->getJson('/api/settings')
            ->assertOk()
            ->assertJsonPath('data.shop_logo', 'https://api.petposture.com/storage/settings/storefront-logo.png')
            ->assertJsonPath('data.shop_favicon', 'https://api.petposture.com/storage/settings/storefront-favicon.png')
            ->assertJsonPath('data.admin_logo', 'https://api.petposture.com/storage/settings/admin-logo.png')
            ->assertJsonPath('data.admin_favicon', 'https://api.petposture.com/storage/settings/admin-favicon.png');
    }

    public function test_settings_expose_frontend_url(): void
    {
        config(['app.frontend_url' => 'https://petposture.com']);

        $this->getJson('/api/settings')
            ->assertOk()
            ->assertJsonPath('data.frontend_url', 'https://petposture.com');
    }

    public function test_frontend_url_is_trailing_slash_trimmed(): void
    {
        config(['app.frontend_url' => 'http://petposture.test:3000/']);

        $this->getJson('/api/settings')
            ->assertOk()
            ->assertJsonPath('data.frontend_url', 'http://petposture.test:3000');
    }

    public function test_settings_response_is_cached_and_setting_changes_invalidate_the_exact_key(): void
    {
        Setting::set('shop_name', 'Before');

        $first = $this->getJson('/api/settings')->assertOk();
        $this->assertTrue(Cache::has('public-api:settings:v1'));

        Setting::withoutEvents(fn () => Setting::where('key', 'shop_name')->update(['value' => 'Database only']));
        $second = $this->getJson('/api/settings')->assertOk();
        $this->assertSame($first->json(), $second->json());

        Setting::set('shop_name', 'After');
        $this->assertFalse(Cache::has('public-api:settings:v1'));

        $this->getJson('/api/settings')
            ->assertOk()
            ->assertJsonPath('data.shop_name', 'After');
    }
}
