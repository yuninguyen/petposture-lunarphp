<?php

namespace Tests\Feature;

use App\Http\Middleware\AttachCloudflarePurgeWarning;
use App\Jobs\PurgeCloudflareCache;
use App\Models\Setting;
use App\Services\CloudflareCacheService;
use App\Services\StorefrontRefreshJournal;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Bus;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use PHPUnit\Framework\Attributes\DataProvider;
use RuntimeException;
use Tests\TestCase;

class JournalOwnerReplayTest extends TestCase
{
    private string $database;
    protected function setUp(): void
    {
        parent::setUp();
        $this->database = tempnam(storage_path('framework/testing'), 'owner-replay-');
        config(['database.connections.sqlite.database' => $this->database]);
        DB::purge('sqlite');
        $this->artisan('migrate', ['--force' => true])->assertExitCode(0);
        config(['services.cloudflare.api_token' => 'test-only', 'services.cloudflare.zone_id' => 'test-zone']);
        Http::preventStrayRequests();
        \Tests\Fixtures\StorefrontHttp::fake(fn () => Http::response(['success' => false], 503));
    }
    protected function tearDown(): void
    {
        $this->travelBack();
        foreach (DB::getConnections() as $connection) $connection->disconnect();
        parent::tearDown(); gc_collect_cycles(); unlink($this->database);
    }
    public static function owners(): array { return [['non-http'], ['late'], ['initial']]; }

    #[DataProvider('owners')]
    public function test_real_observer_snapshot_survives_dispatch_loss_and_scope_reset_then_replays(string $owner): void
    {
        $setting = Setting::withoutEvents(fn () => Setting::create(['key' => 'old', 'value' => 'before']));
        Bus::shouldReceive('dispatch')->andThrow(new RuntimeException('queue unavailable'));
        $save = function () use ($setting) { $setting->update(['key' => 'new', 'value' => 'committed']); };
        if ($owner === 'non-http') {
            DB::transaction($save);
        } else {
            $response = app(AttachCloudflarePurgeWarning::class)->handle(Request::create('/api/admin/save', 'POST'), function () use ($save, $owner) {
                if ($owner === 'late') DB::beginTransaction();
                $save();
                return new Response('saved', 201);
            });
            $this->assertSame('saved', $response->getContent());
            if ($owner === 'late') DB::commit();
        }
        $row = DB::table('storefront_refresh_journal')->sole();
        $this->assertSame(['setting:old', 'setting:new'], json_decode($row->cache_keys, true));
        $this->assertSame('committed', Setting::where('key', 'new')->value('value'));
        app()->forgetScopedInstances();
        DB::purge(StorefrontRefreshJournal::CONNECTION);
        $this->travel(301)->seconds();
        Cache::put('setting:old', 'stale'); Cache::put('setting:new', 'stale');
        Bus::fake();
        app(StorefrontRefreshJournal::class)->replay();
        $job = Bus::dispatched(PurgeCloudflareCache::class)->sole();
        $this->assertSame($row->id, $job->journalId);
        Http::swap(new \Illuminate\Http\Client\Factory);
        Http::preventStrayRequests();
        \Tests\Fixtures\StorefrontHttp::fake(function () {
            $this->assertFalse(Cache::has('setting:old'));
            $this->assertFalse(Cache::has('setting:new'));
            return Http::response(['success' => true]);
        });
        $job->handle(app(CloudflareCacheService::class));
        $this->assertSame('completed', app(StorefrontRefreshJournal::class)->find($row->id)->state);
    }
}
