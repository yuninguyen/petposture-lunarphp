<?php

namespace Tests\Feature;

use App\Http\Middleware\AttachCloudflarePurgeWarning;
use App\Models\Setting;
use App\Models\User;
use App\Services\StorefrontRefreshJournal;
use App\Support\CloudflarePurgeNotice;
use Filament\Notifications\Livewire\Notifications;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Bus;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Livewire\Livewire;
use RuntimeException;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class StorefrontRecoveryNotificationTest extends TestCase
{
    private string $database;
    private const MESSAGE = 'Content saved; cache refresh recovery could not be recorded. Automatic retry is not guaranteed; operator action is required.';

    protected function setUp(): void
    {
        parent::setUp();
        $this->withoutVite();
        $this->database = tempnam(storage_path('framework/testing'), 'journal-notice-');
        config(['app.key' => 'base64:'.base64_encode(str_repeat('t', 32)),
            'database.default' => 'sqlite', 'database.connections.sqlite.database' => $this->database,
            'database.connections.sqlite.url' => null, 'session.driver' => 'array']);
        DB::purge('sqlite');
        $this->artisan('migrate', ['--force' => true])->assertExitCode(0);
        Bus::fake();
        Http::preventStrayRequests();
        Http::fake();
    }

    protected function tearDown(): void
    {
        foreach (DB::getConnections() as $connection) $connection->disconnect();
        parent::tearDown();
        gc_collect_cycles();
        unlink($this->database);
    }

    public function test_raw_livewire_saved_response_delivers_late_critical_notification_via_filament_session(): void
    {
        Role::firstOrCreate(['name' => 'admin', 'guard_name' => 'web']);
        $user = User::factory()->create(['is_active' => true]);
        $user->assignRole('admin');
        $this->actingAs($user);
        $html = $this->get('/admin/manage-settings')->assertOk()->getContent();
        preg_match_all('/wire:snapshot="([^"]+)"/', $html, $matches);
        $snapshot = null;
        foreach ($matches[1] as $encoded) {
            $candidate = html_entity_decode($encoded, ENT_QUOTES | ENT_HTML5, 'UTF-8');
            if (str_ends_with(json_decode($candidate, true)['memo']['name'], 'manage-settings')) $snapshot = $candidate;
        }
        $this->assertNotNull($snapshot);
        $this->mock(StorefrontRefreshJournal::class)->shouldReceive('record')->andThrow(new RuntimeException('private DB secret'));
        $response = $this->postJson('/livewire/update', ['components' => [[
            'snapshot' => $snapshot, 'updates' => ['data.shop_name' => 'Saved despite failure'],
            'calls' => [['path' => '', 'method' => 'save', 'params' => []]],
        ]]], ['X-Livewire' => 'true'])->assertOk();
        $this->assertSame('Saved despite failure', Setting::where('key', 'shop_name')->value('value'));
        $this->assertEmpty(json_decode($response->json('components.0.snapshot'), true)['memo']['errors'] ?? []);
        $response->assertHeaderMissing('X-PetPosture-Cache-Warning')->assertHeaderMissing('X-PetPosture-Cache-Recovery');
        $critical = collect(session('filament.notifications', []))->firstWhere('status', 'danger');
        $this->assertNotNull($critical);
        $this->assertSame(self::MESSAGE, $critical['body']);
        $this->assertSame('persistent', $critical['duration']);
        $this->assertCount(1, collect($response->json('components.0.effects.dispatches'))->where('name', 'notificationsSent'));
        // Filament's actual pull consumes the session warning and renders its truthful copy.
        Livewire::test(Notifications::class)->assertSee(self::MESSAGE);
        $this->assertEmpty(session('filament.notifications', []));
        Bus::assertNothingDispatched();
        Http::assertNothingSent();
    }

    public function test_late_notification_adds_wakeup_when_component_had_no_notification_at_dehydration(): void
    {
        $request = Request::create('/livewire/update', 'POST', server: ['HTTP_X_LIVEWIRE' => 'true']);
        $request->setLaravelSession(app('session.store'));
        $original = new JsonResponse(['components' => [['snapshot' => 'unchanged', 'effects' => ['html' => 'saved']]]]);
        $response = app(AttachCloudflarePurgeWarning::class)->handle($request, function () use ($original) {
            app(CloudflarePurgeNotice::class)->markRecoveryUnavailable();
            return $original;
        });
        $this->assertSame($original, $response);
        $data = $response->getData(true);
        $this->assertSame('unchanged', $data['components'][0]['snapshot']);
        $this->assertSame('saved', $data['components'][0]['effects']['html']);
        $this->assertSame([['name' => 'notificationsSent', 'params' => []]], $data['components'][0]['effects']['dispatches'] ?? []);
    }

    public function test_web_redirect_retains_warning_for_next_page_without_changing_response(): void
    {
        $request = Request::create('/admin/save', 'POST');
        $request->setLaravelSession(app('session.store'));
        $original = redirect('/admin/manage-settings');
        $response = app(AttachCloudflarePurgeWarning::class)->handle($request, function () use ($original) {
            app(CloudflarePurgeNotice::class)->markRecoveryUnavailable();
            return $original;
        });
        $this->assertSame($original, $response);
        $this->assertSame(self::MESSAGE, collect(session('filament.notifications', []))->firstWhere('status', 'danger')['body'] ?? null);
        $this->assertNull($response->headers->get('X-PetPosture-Cache-Recovery'));
    }

    public function test_session_notification_failure_cannot_replace_original_exception(): void
    {
        $request = Request::create('/admin/save', 'POST');
        $session = \Mockery::mock(\Illuminate\Session\Store::class);
        $session->shouldReceive('push')->once()->andThrow(new RuntimeException('session failure'));
        $request->setLaravelSession($session);
        app()->instance('session.store', $session);
        app()->instance('session', $session);
        $original = new RuntimeException('original handler');
        try {
            app(AttachCloudflarePurgeWarning::class)->handle($request, function () use ($original) {
                app(CloudflarePurgeNotice::class)->markRecoveryUnavailable();
                throw $original;
            });
            $this->fail('Expected original exception');
        } catch (RuntimeException $actual) {
            $this->assertSame($original, $actual);
        }
    }

    public function test_livewire_redirect_effect_is_preserved_without_wakeup(): void
    {
        $request = Request::create('/livewire/update', 'POST', server: ['HTTP_X_LIVEWIRE' => 'true']);
        $request->setLaravelSession(app('session.store'));
        $payload = ['components' => [['snapshot' => 'unchanged', 'effects' => ['redirect' => '/admin/media']]]];
        $original = new JsonResponse($payload);
        $response = app(AttachCloudflarePurgeWarning::class)->handle($request, function () use ($original) {
            app(CloudflarePurgeNotice::class)->markRecoveryUnavailable();
            return $original;
        });
        $this->assertSame($payload, $response->getData(true));
        $this->assertSame(self::MESSAGE, collect(session('filament.notifications', []))->firstWhere('status', 'danger')['body'] ?? null);
    }

    public function test_session_notification_failure_preserves_successful_response(): void
    {
        $request = Request::create('/admin/save', 'POST');
        $session = \Mockery::mock(\Illuminate\Session\Store::class);
        $session->shouldReceive('push')->once()->andThrow(new RuntimeException('session failure'));
        $request->setLaravelSession($session);
        app()->instance('session.store', $session);
        app()->instance('session', $session);
        $original = new Response('saved', 201);
        $response = app(AttachCloudflarePurgeWarning::class)->handle($request, function () use ($original) {
            app(CloudflarePurgeNotice::class)->markRecoveryUnavailable();
            return $original;
        });
        $this->assertSame($original, $response);
        $this->assertSame(201, $response->status());
        $this->assertSame('saved', $response->getContent());
    }

    public function test_recorded_pending_and_api_unavailable_do_not_create_critical_web_notification(): void
    {
        $request = Request::create('/admin/save', 'POST');
        $request->setLaravelSession(app('session.store'));
        app(CloudflarePurgeNotice::class)->markPending();
        app(AttachCloudflarePurgeWarning::class)->handle($request, fn () => new Response('saved'));
        $this->assertEmpty(session('filament.notifications', []));
        app(CloudflarePurgeNotice::class)->markRecoveryUnavailable();
        $api = Request::create('/api/admin/save', 'POST');
        $api->setLaravelSession(app('session.store'));
        $response = app(AttachCloudflarePurgeWarning::class)->handle($api, fn () => new Response('saved'));
        $this->assertSame('unavailable', $response->headers->get('X-PetPosture-Cache-Recovery'));
        $this->assertEmpty(session('filament.notifications', []));
    }
}
