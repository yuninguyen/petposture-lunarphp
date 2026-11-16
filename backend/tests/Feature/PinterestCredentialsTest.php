<?php

namespace Tests\Feature;

use App\Models\Setting;
use App\Models\User;
use App\Services\Pinterest\PinterestClient;
use App\Services\Pinterest\PinterestCredentials;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * The Pinterest app's details, entered in the admin: they win over .env, the secret is stored encrypted and never
 * returned, and a blank secret never wipes the saved one.
 */
class PinterestCredentialsTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(RoleSeeder::class);
        config([
            'services.pinterest.app_id' => null,
            'services.pinterest.app_secret' => null,
            'services.pinterest.redirect_uri' => null,
            'services.pinterest.api_base' => 'https://api.pinterest.com/v5',
        ]);
    }

    private function credentials(): PinterestCredentials
    {
        return app(PinterestCredentials::class);
    }

    private function actingAsAdmin(string $role = 'admin'): User
    {
        $user = User::factory()->create();
        $user->assignRole($role);
        Sanctum::actingAs($user);

        return $user;
    }

    private function payload(array $overrides = []): array
    {
        return array_merge([
            'app_id' => '1234567',
            'app_secret' => 'secret-12345678',
            'redirect_uri' => 'https://admin.petposture.com/system/integrations/pinterest/callback',
            'sandbox' => true,
        ], $overrides);
    }

    // ---------------------------------------------------------------- the service

    public function test_nothing_is_set_until_the_owner_or_the_env_provides_it(): void
    {
        $this->assertNull($this->credentials()->appId());
        $this->assertNull($this->credentials()->appSecret());
        $this->assertFalse($this->credentials()->isComplete());
        $this->assertFalse(app(PinterestClient::class)->isConfigured());
    }

    public function test_the_env_values_still_work_when_nothing_is_saved(): void
    {
        config([
            'services.pinterest.app_id' => '7654321',
            'services.pinterest.app_secret' => 'env-secret-1234',
            'services.pinterest.redirect_uri' => 'https://admin.petposture.com/cb',
        ]);

        $this->assertSame('7654321', $this->credentials()->appId());
        $this->assertSame('env-secret-1234', $this->credentials()->appSecret());
        $this->assertTrue($this->credentials()->isComplete());
    }

    public function test_what_the_owner_saved_wins_over_the_env(): void
    {
        config(['services.pinterest.app_id' => '7654321', 'services.pinterest.app_secret' => 'env-secret-1234']);

        $this->credentials()->update($this->payload());

        $this->assertSame('1234567', $this->credentials()->appId());
        $this->assertSame('secret-12345678', $this->credentials()->appSecret());
    }

    public function test_the_secret_is_stored_encrypted(): void
    {
        $this->credentials()->update($this->payload());

        $raw = DB::table('settings')->where('key', 'pinterest.app_secret')->value('value');

        $this->assertNotNull($raw);
        $this->assertStringNotContainsString('secret-12345678', $raw);
        $this->assertSame('secret-12345678', $this->credentials()->appSecret());
    }

    public function test_a_blank_secret_keeps_the_saved_one(): void
    {
        $this->credentials()->update($this->payload());

        $this->credentials()->update($this->payload(['app_id' => '9999999', 'app_secret' => null]));
        $this->credentials()->update($this->payload(['app_secret' => '']));

        $this->assertSame('secret-12345678', $this->credentials()->appSecret());
    }

    public function test_an_unreadable_secret_counts_as_not_set(): void
    {
        Setting::set('pinterest.app_secret', 'not-encrypted-at-all', 'string', 'pinterest');

        $this->assertNull($this->credentials()->appSecret());
        $this->assertFalse($this->credentials()->hasSecret());
    }

    public function test_sandbox_sends_calls_to_the_pinterest_sandbox(): void
    {
        $this->credentials()->update($this->payload(['sandbox' => true]));
        $this->assertSame('https://api-sandbox.pinterest.com/v5', $this->credentials()->apiBase());

        $this->credentials()->update($this->payload(['sandbox' => false]));
        $this->assertSame('https://api.pinterest.com/v5', $this->credentials()->apiBase());
    }

    public function test_the_client_uses_the_saved_details_and_the_sandbox(): void
    {
        $this->credentials()->update($this->payload(['app_id' => '1640223', 'sandbox' => true]));
        Http::fake([
            'api-sandbox.pinterest.com/v5/oauth/token' => Http::response(['access_token' => 'a', 'refresh_token' => 'r', 'expires_in' => 1000]),
            'api-sandbox.pinterest.com/v5/user_account' => Http::response(['id' => 'u', 'username' => 'pp']),
        ]);

        $client = app(PinterestClient::class);
        $this->assertTrue($client->isConfigured());
        $this->assertStringContainsString('client_id=1640223', $client->authorizationUrl('s'));

        $client->connect('code');

        Http::assertSent(fn ($request) => str_starts_with($request->url(), 'https://api-sandbox.pinterest.com/v5/oauth/token')
            && $request->header('Authorization')[0] === 'Basic '.base64_encode('1640223:secret-12345678'));
    }

    // ---------------------------------------------------------------- the endpoint

    public function test_the_admin_saves_the_details_and_the_secret_is_never_returned(): void
    {
        $this->actingAsAdmin();

        $response = $this->putJson('/api/admin/pinterest/credentials', $this->payload(['app_id' => '1640223']))->assertOk();

        $response->assertJsonPath('data.app_id', '1640223')
            ->assertJsonPath('data.sandbox', true)
            ->assertJsonPath('data.has_secret', true);
        $this->assertStringNotContainsString('secret-12345678', $response->getContent());

        $shown = $this->getJson('/api/admin/pinterest/connection')->assertOk();
        $shown->assertJsonPath('data.configured', true)
            ->assertJsonPath('data.credentials.app_id', '1640223')
            ->assertJsonPath('data.credentials.has_secret', true);
        $this->assertStringNotContainsString('secret-12345678', $shown->getContent());
    }

    public function test_the_first_save_needs_a_secret_but_a_later_one_does_not(): void
    {
        $this->actingAsAdmin();

        $this->putJson('/api/admin/pinterest/credentials', $this->payload(['app_secret' => null]))
            ->assertUnprocessable()
            ->assertJsonValidationErrors('app_secret');

        $this->putJson('/api/admin/pinterest/credentials', $this->payload())->assertOk();
        $this->putJson('/api/admin/pinterest/credentials', $this->payload(['app_secret' => null, 'sandbox' => false]))
            ->assertOk()
            ->assertJsonPath('data.sandbox', false);

        $this->assertSame('secret-12345678', $this->credentials()->appSecret());
    }

    public function test_the_details_are_checked(): void
    {
        $this->actingAsAdmin();

        $this->putJson('/api/admin/pinterest/credentials', $this->payload(['app_id' => 'abc']))->assertUnprocessable()->assertJsonValidationErrors('app_id');
        $this->putJson('/api/admin/pinterest/credentials', $this->payload(['redirect_uri' => 'not a url']))->assertUnprocessable()->assertJsonValidationErrors('redirect_uri');
        $this->putJson('/api/admin/pinterest/credentials', $this->payload(['app_secret' => 'short']))->assertUnprocessable()->assertJsonValidationErrors('app_secret');
        $this->putJson('/api/admin/pinterest/credentials', $this->payload(['sandbox' => 'maybe']))->assertUnprocessable()->assertJsonValidationErrors('sandbox');
    }

    public function test_only_the_core_admin_roles_can_save_them(): void
    {
        foreach (['Product Manager', 'Order Manager', 'Support', 'Content Writer'] as $role) {
            $this->actingAsAdmin($role);

            $this->putJson('/api/admin/pinterest/credentials', $this->payload())->assertForbidden();
        }

        $this->assertNull($this->credentials()->appId());
    }

    public function test_a_visitor_cannot_save_them(): void
    {
        $this->putJson('/api/admin/pinterest/credentials', $this->payload())->assertUnauthorized();
    }

    public function test_connecting_works_once_the_details_are_saved_in_the_admin(): void
    {
        $this->actingAsAdmin();
        $this->postJson('/api/admin/pinterest/connect')->assertUnprocessable();

        $this->putJson('/api/admin/pinterest/credentials', $this->payload())->assertOk();

        $this->postJson('/api/admin/pinterest/connect')->assertOk()->assertJsonStructure(['data' => ['url']]);
    }
}
