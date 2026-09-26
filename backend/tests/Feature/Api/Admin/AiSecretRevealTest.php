<?php

namespace Tests\Feature\Api\Admin;

use App\Models\Setting;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Spatie\Activitylog\Models\Activity;
use Tests\TestCase;

class AiSecretRevealTest extends TestCase
{
    use RefreshDatabase;

    private const SECRET = 'sk-test-synthetic-value-1234';

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(RoleSeeder::class);
    }

    private function actingAsRole(string $role): void
    {
        $user = User::factory()->create();
        $user->assignRole($role);
        Sanctum::actingAs($user);
    }

    public function test_core_admin_can_reveal_a_stored_secret_with_no_store_caching(): void
    {
        Setting::set('openai_api_key', self::SECRET, 'string', 'ai');
        $this->actingAsRole('admin');

        $response = $this->getJson('/api/admin/settings/ai/reveal/openai_api_key');

        $response->assertOk()->assertJsonPath('data.value', self::SECRET);
        $this->assertStringContainsString('no-store', (string) $response->headers->get('Cache-Control'));
    }

    public function test_reveal_is_audited_without_storing_the_secret(): void
    {
        Setting::set('anthropic_api_key', self::SECRET, 'string', 'ai');
        $this->actingAsRole('super_admin');

        $this->getJson('/api/admin/settings/ai/reveal/anthropic_api_key')->assertOk();

        $activity = Activity::query()->where('description', 'revealed_secret')->first();
        $this->assertNotNull($activity);
        $this->assertSame('anthropic_api_key', $activity->properties['field']);
        $this->assertStringNotContainsString(self::SECRET, json_encode($activity->properties));
    }

    public function test_reveal_returns_404_when_nothing_is_stored_in_the_database(): void
    {
        $this->actingAsRole('admin');

        $this->getJson('/api/admin/settings/ai/reveal/openai_api_key')->assertNotFound();
        $this->assertSame(0, Activity::query()->where('description', 'revealed_secret')->count());
    }

    public function test_only_secret_ai_fields_can_be_revealed(): void
    {
        Setting::set('openai_model', 'gpt-test', 'string', 'ai');
        $this->actingAsRole('admin');

        $this->getJson('/api/admin/settings/ai/reveal/openai_model')->assertNotFound();
        $this->getJson('/api/admin/settings/ai/reveal/smtp_pass')->assertNotFound();
        $this->getJson('/api/admin/settings/ai/reveal/anything_else')->assertNotFound();
    }

    public function test_business_roles_and_guests_cannot_reveal(): void
    {
        Setting::set('openai_api_key', self::SECRET, 'string', 'ai');

        foreach (['Product Manager', 'Order Manager', 'Support'] as $role) {
            $this->actingAsRole($role);
            $this->getJson('/api/admin/settings/ai/reveal/openai_api_key')->assertForbidden();
        }

        $this->app['auth']->forgetGuards();
        $this->getJson('/api/admin/settings/ai/reveal/openai_api_key')->assertUnauthorized();
    }
}
