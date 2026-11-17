<?php

namespace Tests\Feature\Api\Admin;

use App\Models\PinterestConnection;
use App\Models\PinterestPin;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class PinterestConnectionControllerTest extends TestCase
{
    use RefreshDatabase;

    private const CORE_ROLES = ['super_admin', 'admin', 'staff'];

    private const BLOCKED_ROLES = ['Product Manager', 'Order Manager', 'Support', 'Content Writer'];

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(RoleSeeder::class);
        config([
            'services.pinterest.app_id' => '1640181',
            'services.pinterest.app_secret' => 'test-secret',
            'services.pinterest.redirect_uri' => 'https://admin.petposture.com/system/integrations/pinterest/callback',
            'services.pinterest.api_base' => 'https://api.pinterest.com/v5',
        ]);
    }

    private function actingAsRole(string $role = 'admin'): User
    {
        $user = User::factory()->create();
        $user->assignRole($role);
        Sanctum::actingAs($user);

        return $user;
    }

    private function connection(): PinterestConnection
    {
        return PinterestConnection::query()->create([
            'username' => 'petposture',
            'access_token' => 'access-token-secret',
            'refresh_token' => 'refresh-token-secret',
            'access_expires_at' => now()->addDays(20),
            'refresh_expires_at' => now()->addDays(300),
            'status' => 'connected',
        ]);
    }

    // ---------------------------------------------------------------- who may use it

    public function test_a_visitor_is_not_logged_in(): void
    {
        $this->getJson('/api/admin/pinterest/connection')->assertUnauthorized();
        $this->postJson('/api/admin/pinterest/connect')->assertUnauthorized();
        $this->getJson('/api/admin/pinterest/boards')->assertUnauthorized();
    }

    public function test_the_core_admin_roles_can_see_the_connection(): void
    {
        foreach (self::CORE_ROLES as $role) {
            $this->actingAsRole($role);

            $this->getJson('/api/admin/pinterest/connection')->assertOk();
        }
    }

    public function test_no_business_role_can_see_or_change_the_connection(): void
    {
        $this->connection();

        foreach (self::BLOCKED_ROLES as $role) {
            $this->actingAsRole($role);

            $this->getJson('/api/admin/pinterest/connection')->assertForbidden();
            $this->postJson('/api/admin/pinterest/connect')->assertForbidden();
            $this->postJson('/api/admin/pinterest/callback', ['code' => 'c', 'state' => 's'])->assertForbidden();
            $this->deleteJson('/api/admin/pinterest/connection')->assertForbidden();
            $this->getJson('/api/admin/pinterest/boards')->assertForbidden();
            $this->postJson('/api/admin/pinterest/boards', ['name' => 'Feeding'])->assertForbidden();
            $this->putJson('/api/admin/pinterest/settings', ['auto_publish' => true])->assertForbidden();
        }

        $this->assertSame('connected', PinterestConnection::current()->status);
    }

    // ---------------------------------------------------------------- what the connection shows

    public function test_it_shows_who_is_connected_and_never_a_token(): void
    {
        $this->actingAsRole();
        $this->connection();

        $response = $this->getJson('/api/admin/pinterest/connection')->assertOk();

        $response->assertJsonPath('data.connected', true)
            ->assertJsonPath('data.username', 'petposture')
            ->assertJsonPath('data.configured', true);
        $this->assertStringNotContainsString('access-token-secret', $response->getContent());
        $this->assertStringNotContainsString('refresh-token-secret', $response->getContent());
    }

    public function test_before_connecting_it_says_so_and_posting_is_off_by_default(): void
    {
        $this->actingAsRole();

        $this->getJson('/api/admin/pinterest/connection')
            ->assertOk()
            ->assertJsonPath('data.connected', false)
            ->assertJsonPath('data.status', 'not_connected')
            ->assertJsonPath('data.settings.auto_publish', false)
            ->assertJsonPath('data.settings.max_per_day', 3);
    }

    // ---------------------------------------------------------------- connecting

    public function test_connecting_hands_back_the_pinterest_page_to_visit(): void
    {
        $this->actingAsRole();

        $url = $this->postJson('/api/admin/pinterest/connect')->assertOk()->json('data.url');

        $this->assertStringStartsWith('https://www.pinterest.com/oauth/?', $url);
        parse_str((string) parse_url($url, PHP_URL_QUERY), $query);
        $this->assertSame('1640181', $query['client_id']);
        $this->assertSame('code', $query['response_type']);
        $this->assertNotEmpty($query['state']);
    }

    public function test_connecting_needs_the_server_to_be_set_up(): void
    {
        config(['services.pinterest.app_secret' => null]);
        $this->actingAsRole();

        $this->postJson('/api/admin/pinterest/connect')->assertUnprocessable();
    }

    public function test_the_callback_connects_the_account_when_the_state_matches(): void
    {
        $this->actingAsRole();
        Http::fake([
            'api.pinterest.com/v5/oauth/token' => Http::response(['access_token' => 'a', 'refresh_token' => 'r', 'expires_in' => 100000]),
            'api.pinterest.com/v5/user_account' => Http::response(['id' => 'u1', 'username' => 'petposture']),
        ]);

        parse_str((string) parse_url($this->postJson('/api/admin/pinterest/connect')->json('data.url'), PHP_URL_QUERY), $query);

        $this->postJson('/api/admin/pinterest/callback', ['code' => 'the-code', 'state' => $query['state']])
            ->assertOk()
            ->assertJsonPath('data.username', 'petposture');

        $this->assertSame('petposture', PinterestConnection::current()->username);
    }

    public function test_the_callback_refuses_a_state_it_did_not_issue_or_one_used_twice(): void
    {
        $this->actingAsRole();
        Http::fake([
            'api.pinterest.com/v5/oauth/token' => Http::response(['access_token' => 'a', 'refresh_token' => 'r', 'expires_in' => 100000]),
            'api.pinterest.com/v5/user_account' => Http::response(['id' => 'u1', 'username' => 'petposture']),
        ]);

        $this->postJson('/api/admin/pinterest/callback', ['code' => 'c', 'state' => 'made-up'])->assertUnprocessable();
        $this->assertNull(PinterestConnection::current());

        parse_str((string) parse_url($this->postJson('/api/admin/pinterest/connect')->json('data.url'), PHP_URL_QUERY), $query);
        $this->postJson('/api/admin/pinterest/callback', ['code' => 'c', 'state' => $query['state']])->assertOk();
        $this->postJson('/api/admin/pinterest/callback', ['code' => 'c', 'state' => $query['state']])->assertUnprocessable();
    }

    public function test_another_admins_state_does_not_work(): void
    {
        $this->actingAsRole();
        parse_str((string) parse_url($this->postJson('/api/admin/pinterest/connect')->json('data.url'), PHP_URL_QUERY), $query);

        $this->actingAsRole('staff');
        Http::fake();

        $this->postJson('/api/admin/pinterest/callback', ['code' => 'c', 'state' => $query['state']])->assertUnprocessable();
        Http::assertNothingSent();
    }

    public function test_a_refusal_from_pinterest_is_reported_and_connects_nothing(): void
    {
        $this->actingAsRole();
        Http::fake(['api.pinterest.com/v5/oauth/token' => Http::response(['error' => 'invalid_grant', 'error_description' => 'Code expired'], 400)]);

        parse_str((string) parse_url($this->postJson('/api/admin/pinterest/connect')->json('data.url'), PHP_URL_QUERY), $query);

        $this->postJson('/api/admin/pinterest/callback', ['code' => 'old', 'state' => $query['state']])
            ->assertUnprocessable()
            ->assertJsonPath('message', 'Pinterest refused the connection: Code expired');
        $this->assertNull(PinterestConnection::current());
    }

    public function test_disconnecting_forgets_the_tokens(): void
    {
        $this->actingAsRole();
        $this->connection();

        $this->deleteJson('/api/admin/pinterest/connection')->assertNoContent();

        $this->assertNull(PinterestConnection::current());
    }

    // ---------------------------------------------------------------- boards

    public function test_the_boards_come_from_pinterest(): void
    {
        $this->actingAsRole();
        $this->connection();
        Http::fake(['api.pinterest.com/v5/boards*' => Http::response(['items' => [['id' => '2', 'name' => 'Walks'], ['id' => '1', 'name' => 'Feeding']]])]);

        $this->getJson('/api/admin/pinterest/boards')
            ->assertOk()
            ->assertExactJson(['data' => [['id' => '1', 'name' => 'Feeding'], ['id' => '2', 'name' => 'Walks']]]);
    }

    private function postedPin(array $overrides = []): PinterestPin
    {
        $pin = PinterestPin::query()->create([
            'image' => 'media/pin.png',
            'title' => 'A posted pin',
            'description' => 'About it.',
            'destination_url' => 'https://petposture.com/blog/a-post',
            'pinterest_board_id' => '222',
            'scheduled_date' => '2026-11-16',
        ]);
        $pin->forceFill(array_merge([
            'status' => 'posted',
            'posted_at' => now(),
            'posted_via' => 'api',
            'pinterest_pin_id' => '111',
            'publish_attempts' => 1,
        ], $overrides))->save();

        return $pin;
    }

    public function test_a_pin_posted_through_the_api_can_be_deleted_on_pinterest_and_becomes_a_draft(): void
    {
        $this->actingAsRole();
        $this->connection();
        $pin = $this->postedPin();
        Http::fake(['api.pinterest.com/v5/pins/111' => Http::response(null, 204)]);

        $this->deleteJson("/api/admin/pinterest/pins/{$pin->id}")->assertOk()->assertJsonPath('data.status', 'ready');

        Http::assertSent(fn ($request) => $request->method() === 'DELETE' && str_ends_with($request->url(), '/pins/111'));
        $pin->refresh();
        $this->assertSame('ready', $pin->status);
        $this->assertNull($pin->pinterest_pin_id);
        $this->assertNull($pin->posted_at);
        $this->assertNull($pin->posted_via);
        $this->assertNull($pin->scheduled_date, 'No date, so the job cannot post it again by itself.');
        $this->assertSame('222', $pin->pinterest_board_id);
    }

    public function test_a_pin_posted_by_hand_cannot_be_deleted_on_pinterest_from_here(): void
    {
        $this->actingAsRole();
        $this->connection();
        $pin = $this->postedPin(['posted_via' => 'manual', 'pinterest_pin_id' => null]);
        Http::fake();

        $this->deleteJson("/api/admin/pinterest/pins/{$pin->id}")->assertUnprocessable();

        Http::assertNothingSent();
        $this->assertSame('posted', $pin->refresh()->status);
    }

    public function test_the_pin_stays_posted_when_pinterest_refuses_to_delete_it(): void
    {
        $this->actingAsRole();
        $this->connection();
        $pin = $this->postedPin();
        Http::fake(['api.pinterest.com/v5/pins/111' => Http::response(['code' => 29, 'message' => 'Not authorized'], 403)]);

        $this->deleteJson("/api/admin/pinterest/pins/{$pin->id}")
            ->assertForbidden()
            ->assertJsonPath('message', 'Pinterest did not allow the deletion. Disconnect and connect again to give the permission, then retry.');

        $this->assertSame('posted', $pin->refresh()->status);
        $this->assertSame('111', $pin->pinterest_pin_id);
    }

    public function test_a_board_can_be_deleted_and_pins_here_lose_only_the_board(): void
    {
        $this->actingAsRole();
        $this->connection();
        $onBoard = $this->postedPin();
        $elsewhere = $this->postedPin(['pinterest_pin_id' => '112']);
        $elsewhere->forceFill(['pinterest_board_id' => '333'])->save();
        Http::fake(['api.pinterest.com/v5/boards/222' => Http::response(null, 204)]);

        $this->deleteJson('/api/admin/pinterest/boards/222')->assertNoContent();

        Http::assertSent(fn ($request) => $request->method() === 'DELETE' && str_ends_with($request->url(), '/boards/222'));
        $this->assertNull($onBoard->refresh()->pinterest_board_id);
        $this->assertSame('posted', $onBoard->status, 'The pin itself is not touched here.');
        $this->assertSame('333', $elsewhere->refresh()->pinterest_board_id);
    }

    public function test_only_numeric_board_ids_are_accepted(): void
    {
        $this->actingAsRole();
        $this->connection();
        Http::fake();

        $this->deleteJson('/api/admin/pinterest/boards/abc')->assertNotFound();

        Http::assertNothingSent();
    }

    public function test_deleting_says_so_when_pinterest_is_not_connected(): void
    {
        $this->actingAsRole();
        $pin = $this->postedPin();

        $this->deleteJson("/api/admin/pinterest/pins/{$pin->id}")->assertForbidden();
        $this->deleteJson('/api/admin/pinterest/boards/222')->assertForbidden();
    }

    public function test_no_business_role_can_delete_on_pinterest(): void
    {
        $this->connection();
        $pin = $this->postedPin();
        Http::fake();

        foreach (self::BLOCKED_ROLES as $role) {
            $this->actingAsRole($role);

            $this->deleteJson("/api/admin/pinterest/pins/{$pin->id}")->assertForbidden();
            $this->deleteJson('/api/admin/pinterest/boards/222')->assertForbidden();
        }

        Http::assertNothingSent();
    }

    public function test_the_boards_say_so_when_pinterest_is_not_connected(): void
    {
        $this->actingAsRole();

        $this->getJson('/api/admin/pinterest/boards')->assertUnauthorized();
    }

    // ---------------------------------------------------------------- the posting switches

    public function test_the_switches_can_be_changed_and_are_remembered(): void
    {
        $this->actingAsRole();

        $this->putJson('/api/admin/pinterest/settings', [
            'auto_publish' => true,
            'max_per_day' => 2,
            'min_gap_minutes' => 240,
            'window_start' => '09:00',
            'window_end' => '20:00',
        ])->assertOk()->assertJsonPath('data.max_per_day', 2);

        $this->getJson('/api/admin/pinterest/connection')
            ->assertJsonPath('data.settings.auto_publish', true)
            ->assertJsonPath('data.settings.min_gap_minutes', 240)
            ->assertJsonPath('data.settings.window_start', '09:00');
    }

    public function test_the_switches_keep_the_pace_cautious(): void
    {
        $this->actingAsRole();

        $this->putJson('/api/admin/pinterest/settings', ['max_per_day' => 50])->assertUnprocessable()->assertJsonValidationErrors('max_per_day');
        $this->putJson('/api/admin/pinterest/settings', ['min_gap_minutes' => 5])->assertUnprocessable()->assertJsonValidationErrors('min_gap_minutes');
        $this->putJson('/api/admin/pinterest/settings', ['window_start' => '20:00', 'window_end' => '09:00'])->assertUnprocessable()->assertJsonValidationErrors('window_end');
        $this->putJson('/api/admin/pinterest/settings', ['timezone' => 'Mars/Olympus'])->assertUnprocessable()->assertJsonValidationErrors('timezone');
    }
}
