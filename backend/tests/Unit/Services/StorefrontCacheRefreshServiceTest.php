<?php

namespace Tests\Unit\Services;

use App\Services\StorefrontCacheRefreshService;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class StorefrontCacheRefreshServiceTest extends TestCase
{
    public function test_expected_read_failure_prevents_invalidation_and_purge_after_eviction(): void
    {
        config()->set('services.storefront.backend_internal_url', 'http://127.0.0.1:8001');
        Cache::put('setting:shop_name', 'old');
        Http::fake(fn () => Http::response([], 500));
        $result = app(StorefrontCacheRefreshService::class)->refresh(['setting:shop_name']);
        $this->assertFalse($result->successful);
        $this->assertNull(Cache::get('setting:shop_name'));
        Http::assertSentCount(1);
        Http::assertSent(fn ($request) => $request->url() === 'http://127.0.0.1:8001/api/settings');
    }

    public function test_active_transaction_rejects_before_eviction_or_network(): void
    {
        Http::fake();
        Cache::put('setting:shop_name', 'old');
        DB::beginTransaction();
        try {
            $result = app(StorefrontCacheRefreshService::class)->refresh(['setting:shop_name']);
            $this->assertFalse($result->successful);
            $this->assertSame('old', Cache::get('setting:shop_name'));
            Http::assertNothingSent();
        } finally {
            DB::rollBack();
        }
    }
}
