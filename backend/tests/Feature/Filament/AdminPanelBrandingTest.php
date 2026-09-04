<?php

namespace Tests\Feature\Filament;

use App\Models\Setting;
use Filament\Facades\Filament;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Tests\TestCase;

class AdminPanelBrandingTest extends TestCase
{
    use RefreshDatabase;

    public function test_panel_uses_admin_branding_settings(): void
    {
        Setting::set('shop_logo', 'settings/storefront-logo.png');
        Setting::set('shop_favicon', 'settings/storefront-favicon.png');
        Setting::set('admin_logo', 'settings/admin/admin-logo.png', 'string', 'admin');
        Setting::set('admin_favicon', 'settings/admin/admin-favicon.png', 'string', 'admin');

        $panel = Filament::getPanel('admin');

        $this->assertStringEndsWith('/storage/settings/admin/admin-logo.png', $panel->getBrandLogo());
        $this->assertStringEndsWith('/storage/settings/admin/admin-favicon.png', $panel->getFavicon());
    }

    public function test_panel_uses_static_admin_branding_fallbacks(): void
    {
        Cache::forget('setting:admin_logo');
        Cache::forget('setting:admin_favicon');

        $panel = Filament::getPanel('admin');

        $this->assertStringEndsWith('/logo.png', $panel->getBrandLogo());
        $this->assertStringEndsWith('/favicon.ico', $panel->getFavicon());
    }
}
