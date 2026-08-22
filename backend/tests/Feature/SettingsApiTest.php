<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SettingsApiTest extends TestCase
{
    use RefreshDatabase;

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
}
