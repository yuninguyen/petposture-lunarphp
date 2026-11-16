<?php

namespace Tests\Feature;

use App\Models\PinterestConnection;
use App\Models\PinterestPin;
use App\Models\PinterestPublishLog;
use App\Models\User;
use App\Services\Pinterest\PinterestClient;
use App\Services\Pinterest\PinterestException;
use App\Services\Pinterest\PinterestPublisher;
use App\Services\Pinterest\PinterestPublishSettings;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/**
 * The Pinterest API side: connecting, keeping the login fresh, and posting due pins within the owner's limits.
 * Pinterest is never called for real: every request goes to Http::fake().
 */
class PinterestPublishingTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(RoleSeeder::class);
        Storage::fake('public');
        config([
            'app.frontend_url' => 'https://petposture.com',
            'services.pinterest.app_id' => '1640181',
            'services.pinterest.app_secret' => 'test-secret',
            'services.pinterest.redirect_uri' => 'https://admin.petposture.com/system/integrations/pinterest/callback',
            'services.pinterest.api_base' => 'https://api.pinterest.com/v5',
        ]);

        // 10:00 in New York, inside the default posting window (08:00 to 21:00).
        Carbon::setTestNow('2026-11-20 15:00:00');
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();

        parent::tearDown();
    }

    private function settings(array $values = []): void
    {
        app(PinterestPublishSettings::class)->update(array_merge(['auto_publish' => true], $values));
    }

    private function connection(array $overrides = []): PinterestConnection
    {
        return PinterestConnection::query()->create(array_merge([
            'pinterest_user_id' => 'u1',
            'username' => 'petposture',
            'access_token' => 'access-token-secret',
            'refresh_token' => 'refresh-token-secret',
            'access_expires_at' => now()->addDays(20),
            'refresh_expires_at' => now()->addDays(300),
            'status' => PinterestConnection::STATUS_CONNECTED,
        ], $overrides));
    }

    private function pin(array $overrides = []): PinterestPin
    {
        Storage::disk('public')->put('media/pin.png', 'png-bytes');

        return PinterestPin::query()->create(array_merge([
            'image' => 'media/pin.png',
            'title' => 'Does your Frenchie eat too fast?',
            'description' => 'About a tilted bowl.',
            'destination_url' => 'https://petposture.com/blog/tilted-bowl-vs-slow-feeder',
            'pinterest_board_id' => 'board-1',
            'scheduled_date' => '2026-11-20',
        ], $overrides));
    }

    private function publisher(): PinterestPublisher
    {
        return app(PinterestPublisher::class);
    }

    private function fakePinterest(): void
    {
        Http::fake([
            'api.pinterest.com/v5/pins' => Http::response(['id' => 'pin-999'], 201),
        ]);
    }

    // ---------------------------------------------------------------- connecting

    public function test_connecting_stores_the_tokens_encrypted_and_who_is_connected(): void
    {
        Http::fake([
            'api.pinterest.com/v5/oauth/token' => Http::response([
                'access_token' => 'new-access',
                'refresh_token' => 'new-refresh',
                'expires_in' => 2592000,
                'refresh_token_expires_in' => 31536000,
                'scope' => 'boards:read,pins:read,pins:write,user_accounts:read',
            ]),
            'api.pinterest.com/v5/user_account' => Http::response(['id' => 'u9', 'username' => 'petposture']),
        ]);

        $connection = app(PinterestClient::class)->connect('the-code');

        $this->assertSame('petposture', $connection->username);
        $this->assertSame('new-access', $connection->refresh()->access_token);

        $raw = DB::table('pinterest_connections')->first();
        $this->assertStringNotContainsString('new-access', $raw->access_token);
        $this->assertStringNotContainsString('new-refresh', $raw->refresh_token);

        Http::assertSent(fn ($request) => str_ends_with($request->url(), '/oauth/token')
            && str_starts_with($request->header('Authorization')[0], 'Basic ')
            && $request['grant_type'] === 'authorization_code'
            && $request['code'] === 'the-code');
    }

    public function test_connecting_again_replaces_the_earlier_connection(): void
    {
        $this->connection(['username' => 'old']);
        Http::fake([
            'api.pinterest.com/v5/oauth/token' => Http::response(['access_token' => 'a', 'refresh_token' => 'r', 'expires_in' => 100000]),
            'api.pinterest.com/v5/user_account' => Http::response(['id' => 'u2', 'username' => 'new']),
        ]);

        app(PinterestClient::class)->connect('code');

        $this->assertSame(1, PinterestConnection::query()->count());
        $this->assertSame('new', PinterestConnection::current()->username);
    }

    public function test_the_authorization_url_asks_only_for_the_scopes_we_need(): void
    {
        $url = app(PinterestClient::class)->authorizationUrl('abc');

        $this->assertStringContainsString('client_id=1640181', $url);
        $this->assertStringContainsString('state=abc', $url);
        parse_str((string) parse_url($url, PHP_URL_QUERY), $query);
        $this->assertSame('boards:read,pins:read,pins:write,user_accounts:read', $query['scope']);
        $this->assertStringNotContainsString('boards:write', $url);
    }

    // ---------------------------------------------------------------- keeping the login fresh

    public function test_a_refused_refresh_marks_the_connection_lost_and_tells_the_admin_once(): void
    {
        $admin = User::factory()->create();
        $admin->assignRole('admin');
        $connection = $this->connection();

        Http::fake(['api.pinterest.com/v5/oauth/token' => Http::response(['error' => 'invalid_grant', 'error_description' => 'Refresh token revoked'], 400)]);

        foreach ([1, 2] as $attempt) {
            try {
                app(PinterestClient::class)->refresh($connection->refresh());
            } catch (PinterestException) {
                // expected
            }
        }

        $this->assertSame('disconnected', $connection->refresh()->status);
        $this->assertSame(1, $admin->notifications()->count(), 'The admin is told once, not on every try.');
        $this->assertSame('pinterest_connection_lost', $admin->notifications()->first()->data['type']);
    }

    public function test_the_refresh_command_renews_a_token_that_is_close_to_expiring(): void
    {
        $this->connection(['access_expires_at' => now()->addDays(3)]);
        Http::fake(['api.pinterest.com/v5/oauth/token' => Http::response(['access_token' => 'fresh', 'refresh_token' => 'fresh-r', 'expires_in' => 2592000])]);

        $this->artisan('pinterest:refresh-token')->expectsOutput('refreshed')->assertSuccessful();

        $this->assertSame('fresh', PinterestConnection::current()->access_token);
        $this->assertTrue(PinterestConnection::current()->access_expires_at->gt(now()->addDays(20)));
    }

    public function test_the_refresh_command_leaves_a_healthy_token_alone(): void
    {
        $this->connection();
        Http::fake();

        $this->artisan('pinterest:refresh-token')->assertSuccessful();

        Http::assertNothingSent();
    }

    public function test_the_refresh_command_warns_once_when_the_refresh_token_is_about_to_lapse(): void
    {
        $admin = User::factory()->create();
        $admin->assignRole('admin');
        $this->connection(['refresh_expires_at' => now()->addDays(5)]);
        Http::fake();

        $this->artisan('pinterest:refresh-token')->assertSuccessful();
        $this->artisan('pinterest:refresh-token')->assertSuccessful();

        $this->assertSame(1, $admin->notifications()->count());
        $this->assertSame('pinterest_connection_expiring', $admin->notifications()->first()->data['type']);
    }

    public function test_a_call_that_is_refused_with_401_is_retried_after_a_refresh(): void
    {
        $this->connection();
        Http::fake([
            'api.pinterest.com/v5/boards*' => Http::sequence()
                ->push(['code' => 2, 'message' => 'Authentication failed.'], 401)
                ->push(['items' => [['id' => 'b2', 'name' => 'Zebra'], ['id' => 'b1', 'name' => 'Apple']]]),
            'api.pinterest.com/v5/oauth/token' => Http::response(['access_token' => 'renewed', 'refresh_token' => 'r', 'expires_in' => 100000]),
        ]);

        $boards = app(PinterestClient::class)->boards();

        $this->assertSame(['Apple', 'Zebra'], array_column($boards, 'name'), 'Boards come back sorted by name.');
        $this->assertSame('renewed', PinterestConnection::current()->access_token);
    }

    // ---------------------------------------------------------------- posting a due pin

    public function test_nothing_is_posted_until_the_owner_switches_it_on(): void
    {
        $this->connection();
        $pin = $this->pin();
        Http::fake();

        $this->assertSame('disabled', $this->publisher()->publishNext());

        Http::assertNothingSent();
        $this->assertSame('ready', $pin->refresh()->status);
    }

    public function test_nothing_is_posted_while_pinterest_is_not_connected(): void
    {
        $this->settings();
        $this->pin();
        Http::fake();

        $this->assertSame('not_connected', $this->publisher()->publishNext());

        $this->connection(['status' => PinterestConnection::STATUS_DISCONNECTED]);
        $this->assertSame('not_connected', $this->publisher()->publishNext());
        Http::assertNothingSent();
    }

    public function test_a_due_pin_is_posted_and_marked_as_posted_by_the_api(): void
    {
        $this->settings();
        $this->connection();
        $pin = $this->pin();
        $this->fakePinterest();

        $this->assertSame('posted', $this->publisher()->publishNext());

        $pin->refresh();
        $this->assertSame('posted', $pin->status);
        $this->assertSame('api', $pin->posted_via);
        $this->assertSame('pin-999', $pin->pinterest_pin_id);
        $this->assertTrue($pin->posted_at->equalTo(now()));
        $this->assertNull($pin->last_error);

        Http::assertSent(fn ($request) => str_ends_with($request->url(), '/pins')
            && $request['board_id'] === 'board-1'
            && $request['title'] === 'Does your Frenchie eat too fast?'
            && $request['link'] === 'https://petposture.com/blog/tilted-bowl-vs-slow-feeder'
            && $request['media_source']['source_type'] === 'image_base64'
            && $request['media_source']['content_type'] === 'image/png'
            && base64_decode($request['media_source']['data']) === 'png-bytes'
            && $request->header('Authorization')[0] === 'Bearer access-token-secret');
    }

    public function test_the_log_records_the_call_and_never_a_token(): void
    {
        $this->settings();
        $this->connection();
        $pin = $this->pin();
        $this->fakePinterest();

        $this->publisher()->publishNext();

        $log = PinterestPublishLog::query()->where('action', 'create_pin')->firstOrFail();
        $this->assertSame($pin->id, $log->pinterest_pin_id);
        $this->assertSame('POST /pins', $log->endpoint);
        $this->assertSame(201, $log->http_status);

        $everything = json_encode(PinterestPublishLog::all()->toArray());
        $this->assertStringNotContainsString('access-token-secret', $everything);
        $this->assertStringNotContainsString('refresh-token-secret', $everything);
        $this->assertStringNotContainsString('test-secret', $everything);
    }

    public function test_a_pin_the_owner_already_posted_by_hand_is_never_posted_again(): void
    {
        $this->settings();
        $this->connection();
        $pin = $this->pin();
        $pin->setStatus('posted')->save();
        $this->fakePinterest();

        $this->assertSame('nothing_due', $this->publisher()->publishNext());

        Http::assertNothingSent();
        $this->assertSame('manual', $pin->refresh()->posted_via);
    }

    public function test_only_pins_with_a_date_that_has_come_and_a_board_are_picked(): void
    {
        $this->settings();
        $this->connection();
        $this->pin(['scheduled_date' => null]);
        $this->pin(['scheduled_date' => '2026-11-21']);
        $this->pin(['pinterest_board_id' => null]);
        $this->fakePinterest();

        $this->assertSame('nothing_due', $this->publisher()->publishNext());

        Http::assertNothingSent();
    }

    public function test_the_oldest_due_pin_goes_first_and_only_one_per_run(): void
    {
        $this->settings(['max_per_day' => 5, 'min_gap_minutes' => 30]);
        $this->connection();
        $later = $this->pin(['title' => 'Later', 'scheduled_date' => '2026-11-20']);
        $earlier = $this->pin(['title' => 'Earlier', 'scheduled_date' => '2026-11-18']);
        $this->fakePinterest();

        $this->publisher()->publishNext();

        $this->assertSame('posted', $earlier->refresh()->status);
        $this->assertSame('ready', $later->refresh()->status);
    }

    public function test_the_daily_limit_holds(): void
    {
        $this->settings(['max_per_day' => 2, 'min_gap_minutes' => 30]);
        $this->connection();
        $this->pin(['title' => 'One']);
        $this->pin(['title' => 'Two']);
        $this->pin(['title' => 'Three']);
        $this->fakePinterest();

        $this->assertSame('posted', $this->publisher()->publishNext());
        Carbon::setTestNow(now()->addHour());
        $this->assertSame('posted', $this->publisher()->publishNext());
        Carbon::setTestNow(now()->addHour());
        $this->assertSame('daily_limit', $this->publisher()->publishNext());

        $this->assertSame(1, PinterestPin::query()->where('status', 'ready')->count());
    }

    public function test_the_gap_between_posts_holds(): void
    {
        $this->settings(['max_per_day' => 5, 'min_gap_minutes' => 180]);
        $this->connection();
        $this->pin(['title' => 'One']);
        $this->pin(['title' => 'Two']);
        $this->fakePinterest();

        $this->assertSame('posted', $this->publisher()->publishNext());
        Carbon::setTestNow(now()->addMinutes(60));
        $this->assertSame('too_soon', $this->publisher()->publishNext());
        Carbon::setTestNow(now()->addMinutes(121));
        $this->assertSame('posted', $this->publisher()->publishNext());
    }

    public function test_nothing_is_posted_outside_the_daily_window(): void
    {
        $this->settings();
        $this->connection();
        $this->pin();
        $this->fakePinterest();

        // 03:00 in New York.
        Carbon::setTestNow('2026-11-20 08:00:00');

        $this->assertSame('outside_window', $this->publisher()->publishNext());
        Http::assertNothingSent();
    }

    public function test_the_publish_command_reports_what_it_did(): void
    {
        $this->settings();
        $this->connection();
        $this->pin();
        $this->fakePinterest();

        $this->artisan('pinterest:publish-next')->expectsOutput('posted')->assertSuccessful();
    }

    // ---------------------------------------------------------------- when Pinterest says no

    public function test_a_timeout_parks_the_pin_for_review_and_is_never_retried_blindly(): void
    {
        $this->settings(['min_gap_minutes' => 30, 'max_per_day' => 5]);
        $this->connection();
        $pin = $this->pin();
        Http::fake(['api.pinterest.com/v5/pins' => Http::response(['message' => 'Server error'], 500)]);

        $this->assertSame('needs_review', $this->publisher()->publishNext());

        $this->assertSame('needs_review', $pin->refresh()->status);
        $this->assertStringContainsString('may have been posted', $pin->last_error);

        Carbon::setTestNow(now()->addHours(2));
        $this->assertSame('nothing_due', $this->publisher()->publishNext());
        Http::assertSentCount(1);
    }

    public function test_a_person_can_confirm_a_parked_pin_was_posted_or_retry_it(): void
    {
        $pin = $this->pin();
        $pin->forceFill(['status' => 'needs_review', 'last_error' => 'unsure', 'publish_attempts' => 1])->save();

        $pin->setStatus('posted')->save();
        $this->assertSame('manual', $pin->refresh()->posted_via);
        $this->assertNotNull($pin->posted_at);

        $pin->setStatus('ready')->save();
        $this->assertSame('ready', $pin->refresh()->status);
        $this->assertNull($pin->last_error);
        $this->assertSame(0, $pin->publish_attempts);
        $this->assertNull($pin->posted_via);
    }

    public function test_a_refused_pin_is_retried_up_to_three_times_then_fails(): void
    {
        $this->settings(['min_gap_minutes' => 30, 'max_per_day' => 9]);
        $this->connection();
        $pin = $this->pin();
        Http::fake(['api.pinterest.com/v5/pins' => Http::response(['code' => 400, 'message' => 'Invalid board'], 400)]);

        $this->assertSame('retry_later', $this->publisher()->publishNext());
        $this->assertSame('ready', $pin->refresh()->status);
        $this->assertSame(1, $pin->publish_attempts);
        $this->assertSame('Invalid board', $pin->last_error);

        Carbon::setTestNow(now()->addHour());
        $this->assertSame('retry_later', $this->publisher()->publishNext());
        Carbon::setTestNow(now()->addHour());
        $this->assertSame('failed', $this->publisher()->publishNext());

        $this->assertSame('failed', $pin->refresh()->status);
        $this->assertSame(3, $pin->publish_attempts);

        Carbon::setTestNow(now()->addHour());
        $this->assertSame('nothing_due', $this->publisher()->publishNext(), 'A failed pin waits for a person.');
    }

    public function test_a_rate_limit_does_not_use_up_an_attempt(): void
    {
        $this->settings();
        $this->connection();
        $pin = $this->pin();
        Http::fake(['api.pinterest.com/v5/pins' => Http::response(['code' => 8, 'message' => 'Too many requests'], 429)]);

        $this->assertSame('retry_later', $this->publisher()->publishNext());

        $pin->refresh();
        $this->assertSame('ready', $pin->status);
        $this->assertSame(0, $pin->publish_attempts);
    }

    public function test_losing_the_login_pauses_posting_and_keeps_the_pin_ready(): void
    {
        $admin = User::factory()->create();
        $admin->assignRole('admin');
        $this->settings();
        $connection = $this->connection();
        $pin = $this->pin();
        Http::fake([
            'api.pinterest.com/v5/pins' => Http::response(['code' => 2, 'message' => 'Authentication failed.'], 401),
            'api.pinterest.com/v5/oauth/token' => Http::response(['access_token' => 'x', 'refresh_token' => 'y', 'expires_in' => 1000]),
        ]);

        $this->assertSame('retry_later', $this->publisher()->publishNext());

        $this->assertSame('disconnected', $connection->refresh()->status);
        $this->assertSame('ready', $pin->refresh()->status);
        $this->assertSame(0, $pin->publish_attempts);
        $this->assertSame(1, $admin->notifications()->count());

        Carbon::setTestNow(now()->addHours(4));
        $this->assertSame('not_connected', $this->publisher()->publishNext());
    }

    public function test_a_link_to_another_site_is_never_posted(): void
    {
        $this->settings();
        $this->connection();
        $pin = $this->pin(['destination_url' => 'https://www.amazon.com/dp/B000?tag=x']);
        Http::fake();

        $this->assertSame('failed', $this->publisher()->publishNext());

        Http::assertNothingSent();
        $this->assertSame('failed', $pin->refresh()->status);
        $this->assertSame('The link must point to this site.', $pin->last_error);
    }

    public function test_a_link_with_www_still_counts_as_our_site(): void
    {
        $this->settings();
        $this->connection();
        $this->pin(['destination_url' => 'https://www.petposture.com/picks/necoichi']);
        $this->fakePinterest();

        $this->assertSame('posted', $this->publisher()->publishNext());
    }

    public function test_a_missing_image_file_fails_the_pin_without_calling_pinterest(): void
    {
        $this->settings();
        $this->connection();
        $pin = $this->pin(['image' => 'media/gone.png']);
        Http::fake();

        $this->assertSame('failed', $this->publisher()->publishNext());

        Http::assertNothingSent();
        $this->assertSame('The image file of this pin is missing.', $pin->refresh()->last_error);
    }

    public function test_a_webp_image_is_sent_as_jpeg(): void
    {
        if (! function_exists('imagewebp') || ! function_exists('imagecreatefromwebp')) {
            $this->markTestSkipped('GD has no WebP support here.');
        }

        $this->settings();
        $this->connection();

        $canvas = imagecreatetruecolor(20, 30);
        ob_start();
        imagewebp($canvas);
        Storage::disk('public')->put('media/pin.webp', (string) ob_get_clean());
        $this->pin(['image' => 'media/pin.webp']);
        $this->fakePinterest();

        $this->assertSame('posted', $this->publisher()->publishNext());

        Http::assertSent(function ($request) {
            if (! str_ends_with($request->url(), '/pins')) {
                return false;
            }

            $bytes = base64_decode($request['media_source']['data']);

            return $request['media_source']['content_type'] === 'image/jpeg' && str_starts_with($bytes, "\xFF\xD8");
        });
    }

    public function test_a_pin_left_in_flight_by_a_dead_run_is_parked_for_review(): void
    {
        $this->settings();
        $this->connection();
        $pin = $this->pin();
        $pin->forceFill(['status' => 'publishing', 'last_attempt_at' => now()->subMinutes(30)])->save();
        Http::fake();

        $this->publisher()->publishNext();

        $this->assertSame('needs_review', $pin->refresh()->status);
    }
}
