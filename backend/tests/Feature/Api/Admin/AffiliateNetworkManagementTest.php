<?php

namespace Tests\Feature\Api\Admin;

use App\Jobs\SyncAffiliateReportJob;
use App\Models\AffiliateClick;
use App\Models\AffiliateNetwork;
use App\Models\AffiliateReport;
use App\Models\BlogCategory;
use App\Models\Post;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class AffiliateNetworkManagementTest extends TestCase
{
    use RefreshDatabase;

    protected User $admin;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(RoleSeeder::class);

        foreach (['super_admin', 'admin', 'staff', 'Product Manager', 'Order Manager', 'Support', 'customer'] as $role) {
            Role::firstOrCreate(['name' => $role, 'guard_name' => 'web']);
        }

        $this->admin = User::factory()->create([
            'is_active' => true,
        ]);
        $this->admin->assignRole('admin');
    }

    public function test_unauthenticated_requests_return_401(): void
    {
        $this->getJson('/api/admin/affiliate/networks')->assertUnauthorized();
        $this->postJson('/api/admin/affiliate/networks', [])->assertUnauthorized();
        $this->getJson('/api/admin/affiliate/networks/1')->assertUnauthorized();
        $this->putJson('/api/admin/affiliate/networks/1', [])->assertUnauthorized();
        $this->deleteJson('/api/admin/affiliate/networks/1')->assertUnauthorized();
        $this->postJson('/api/admin/affiliate/networks/1/sync')->assertUnauthorized();
        $this->getJson('/api/admin/affiliate/reports')->assertUnauthorized();
    }

    public function test_customer_and_non_core_admin_roles_receive_403(): void
    {
        $rolesToBlock = ['customer', 'Product Manager', 'Order Manager', 'Support'];

        foreach ($rolesToBlock as $roleName) {
            $user = User::factory()->create(['is_active' => true]);
            $user->assignRole($roleName);

            Sanctum::actingAs($user);

            $this->getJson('/api/admin/affiliate/networks')->assertForbidden();
            $this->postJson('/api/admin/affiliate/networks', ['name' => 'Test'])->assertForbidden();
            $this->getJson('/api/admin/affiliate/reports')->assertForbidden();
        }
    }

    public function test_index_returns_all_networks_without_api_secrets(): void
    {
        Sanctum::actingAs($this->admin);

        AffiliateNetwork::create([
            'name' => 'Impact Radius',
            'slug' => 'impact',
            'provider' => 'impact',
            'active' => true,
            'api_key' => 'super-secret-api-key',
            'api_secret' => 'super-secret-api-secret',
            'merchant_id' => '12345',
        ]);

        AffiliateNetwork::create([
            'name' => 'Inactive Partner',
            'slug' => 'inactive-partner',
            'active' => false,
        ]);

        $response = $this->getJson('/api/admin/affiliate/networks')->assertOk();

        // 1. Check data format
        $data = $response->json('data');
        $this->assertIsArray($data);

        // 2. ZERO CREDENTIAL EXPOSURE
        $rawContent = $response->getContent();
        $this->assertStringNotContainsString('super-secret-api-key', $rawContent);
        $this->assertStringNotContainsString('super-secret-api-secret', $rawContent);
        $this->assertStringNotContainsString('********', $rawContent);

        $impactItem = collect($data)->firstWhere('slug', 'impact');
        $this->assertNotNull($impactItem);
        $this->assertTrue($impactItem['is_configured']);
        $this->assertArrayNotHasKey('api_key', $impactItem);
        $this->assertArrayNotHasKey('api_secret', $impactItem);

        $inactiveItem = collect($data)->firstWhere('slug', 'inactive-partner');
        $this->assertNotNull($inactiveItem);
        $this->assertFalse($inactiveItem['is_configured']);
        $this->assertFalse($inactiveItem['active']);
    }

    public function test_store_creates_network_and_encrypts_credentials(): void
    {
        Sanctum::actingAs($this->admin);

        $payload = [
            'name' => 'Commission Junction',
            'slug' => 'cj-affiliate',
            'logo' => 'https://example.com/cj.png',
            'active' => true,
            'provider' => 'cj',
            'api_key' => 'raw-secret-key-123',
            'api_secret' => 'raw-secret-token-456',
            'merchant_id' => 'm-789',
            'commission_rate_default' => 8.5,
            'cookie_days' => 30,
        ];

        $response = $this->postJson('/api/admin/affiliate/networks', $payload)->assertCreated();

        // Response should not leak secrets
        $this->assertArrayNotHasKey('api_key', $response->json('data'));
        $this->assertArrayNotHasKey('api_secret', $response->json('data'));
        $this->assertTrue($response->json('data.is_configured'));

        // DB check
        $network = AffiliateNetwork::where('slug', 'cj-affiliate')->first();
        $this->assertNotNull($network);
        $this->assertSame('Commission Junction', $network->name);
        $this->assertSame('raw-secret-key-123', $network->api_key);
        $this->assertSame('raw-secret-token-456', $network->api_secret);
        $this->assertSame(8.5, (float) $network->commission_rate_default);
    }

    public function test_update_preserves_secrets_when_omitted(): void
    {
        Sanctum::actingAs($this->admin);

        $network = AffiliateNetwork::create([
            'name' => 'Original Network',
            'slug' => 'original-net',
            'provider' => 'impact',
            'active' => true,
            'api_key' => 'original-key-keep-me',
            'api_secret' => 'original-secret-keep-me',
        ]);

        // Update name and active, but omit api_key and api_secret
        $updatePayload = [
            'name' => 'Renamed Network',
            'active' => false,
        ];

        $response = $this->putJson("/api/admin/affiliate/networks/{$network->id}", $updatePayload)->assertOk();

        $this->assertSame('Renamed Network', $response->json('data.name'));
        $this->assertFalse($response->json('data.active'));
        $this->assertTrue($response->json('data.is_configured'));

        // DB verify: secrets must be untouched
        $refreshed = $network->fresh();
        $this->assertSame('Renamed Network', $refreshed->name);
        $this->assertSame('original-key-keep-me', $refreshed->api_key);
        $this->assertSame('original-secret-keep-me', $refreshed->api_secret);
    }

    public function test_update_overwrites_secrets_when_provided(): void
    {
        Sanctum::actingAs($this->admin);

        $network = AffiliateNetwork::create([
            'name' => 'Original Network',
            'slug' => 'original-net-2',
            'provider' => 'impact',
            'active' => true,
            'api_key' => 'old-key',
            'api_secret' => 'old-secret',
        ]);

        $updatePayload = [
            'api_key' => 'brand-new-key',
            'api_secret' => 'brand-new-secret',
        ];

        $this->putJson("/api/admin/affiliate/networks/{$network->id}", $updatePayload)->assertOk();

        $refreshed = $network->fresh();
        $this->assertSame('brand-new-key', $refreshed->api_key);
        $this->assertSame('brand-new-secret', $refreshed->api_secret);
    }

    public function test_destroy_deletes_network(): void
    {
        Sanctum::actingAs($this->admin);

        $network = AffiliateNetwork::create([
            'name' => 'To Delete',
            'slug' => 'to-delete',
            'active' => true,
        ]);

        $this->deleteJson("/api/admin/affiliate/networks/{$network->id}")->assertOk();

        $this->assertNull(AffiliateNetwork::find($network->id));
    }

    public function test_sync_dispatches_job_and_returns_202_accepted(): void
    {
        Queue::fake();
        Sanctum::actingAs($this->admin);

        $network = AffiliateNetwork::create([
            'name' => 'Syncable Network',
            'slug' => 'syncable-net',
            'provider' => 'impact',
            'active' => true,
            'api_key' => 'valid-api-key',
        ]);

        $response = $this->postJson("/api/admin/affiliate/networks/{$network->id}/sync")->assertStatus(202);

        $this->assertStringContainsString('Sync triggered successfully', $response->json('message'));

        Queue::assertPushed(SyncAffiliateReportJob::class, function (SyncAffiliateReportJob $job) use ($network) {
            return $job->affiliateNetworkId === $network->id;
        });
    }

    public function test_sync_fails_with_422_when_unconfigured(): void
    {
        Queue::fake();
        Sanctum::actingAs($this->admin);

        $network = AffiliateNetwork::create([
            'name' => 'Unconfigured Network',
            'slug' => 'unconfigured-net',
            'active' => true,
            // provider and api_key are null
        ]);

        $this->postJson("/api/admin/affiliate/networks/{$network->id}/sync")->assertStatus(422);

        Queue::assertNothingPushed();
    }

    public function test_reports_endpoint_returns_overview_by_network_and_by_post_with_ranges(): void
    {
        Sanctum::actingAs($this->admin);

        $net1 = AffiliateNetwork::create(['name' => 'Chewy', 'slug' => 'qa-chewy', 'active' => true]);
        $net2 = AffiliateNetwork::create(['name' => 'Amazon', 'slug' => 'qa-amazon', 'active' => true]);

        $category = BlogCategory::create(['name' => 'Harnesses', 'slug' => 'harnesses']);
        $post = Post::create([
            'title' => 'Top Dog Harnesses',
            'slug' => 'top-dog-harnesses',
            'content' => 'Content',
            'blog_category_id' => $category->id,
            'status' => 'draft',
        ]);

        // Create clicks: 3 clicks in last 3 days for net1 on post, 1 click in last 20 days for net2
        // created_at is not fillable on AffiliateClick, so mass-assigning it via create()
        // is silently dropped — set it directly on the model instance instead.
        $click1 = new AffiliateClick([
            'affiliate_network_id' => $net1->id,
            'post_id' => $post->id,
            'product_name' => 'Harness A',
            'target_url' => 'https://example.com/harness-a',
        ]);
        $click1->created_at = now()->subDays(2);
        $click1->save();

        $click2 = new AffiliateClick([
            'affiliate_network_id' => $net1->id,
            'post_id' => $post->id,
            'product_name' => 'Harness B',
            'target_url' => 'https://example.com/harness-b',
        ]);
        $click2->created_at = now()->subDays(3);
        $click2->save();

        $click3 = new AffiliateClick([
            'affiliate_network_id' => $net2->id,
            'post_id' => $post->id,
            'product_name' => 'Crate',
            'target_url' => 'https://example.com/crate',
        ]);
        $click3->created_at = now()->subDays(20);
        $click3->save();

        // Range 7 test: should count only 2 clicks from net1
        $res7 = $this->getJson('/api/admin/affiliate/reports?range=7')->assertOk();
        $this->assertSame('7', $res7->json('range'));
        $this->assertSame(2, $res7->json('overview.clicks_7d'));
        $this->assertSame(3, $res7->json('overview.clicks_30d'));
        $this->assertSame(3, $res7->json('overview.clicks_all_time'));
        $this->assertSame('Chewy', $res7->json('overview.top_network_30d.name'));

        // by_network in range 7
        $networks7 = $res7->json('by_network');
        $this->assertCount(1, $networks7);
        $this->assertSame('Chewy', $networks7[0]['network_name']);
        $this->assertSame(2, $networks7[0]['clicks']);

        // Range 30 test: both networks
        $res30 = $this->getJson('/api/admin/affiliate/reports?range=30')->assertOk();
        $this->assertCount(2, $res30->json('by_network'));

        // by_post
        $posts = $res30->json('by_post');
        $this->assertNotEmpty($posts);
        $this->assertSame('Top Dog Harnesses', $posts[0]['post_title']);
        $this->assertSame(3, $posts[0]['clicks']);
    }

    public function test_reports_endpoint_distinguishes_tracked_clicks_from_unimported_conversions(): void
    {
        Sanctum::actingAs($this->admin);

        $network = AffiliateNetwork::create([
            'name' => 'Tracked Only Network',
            'slug' => 'tracked-only',
            'active' => true,
        ]);

        $category = BlogCategory::create(['name' => 'Tracked Only Category', 'slug' => 'tracked-only-category']);
        $post = Post::create([
            'title' => 'Tracked Only Post',
            'slug' => 'tracked-only-post',
            'content' => 'Content',
            'blog_category_id' => $category->id,
            'status' => 'draft',
        ]);

        AffiliateClick::create([
            'affiliate_network_id' => $network->id,
            'post_id' => $post->id,
            'target_url' => 'https://example.com/tracked-only',
            'created_at' => now()->subDays(5),
        ]);

        // When no AffiliateReport rows exist:
        $response = $this->getJson('/api/admin/affiliate/reports?range=30')->assertOk();
        $this->assertFalse($response->json('overview.has_synced_data'));
        $this->assertNull($response->json('overview.conversions_synced'));
        $this->assertNull($response->json('overview.commission_amount_synced'));
        $this->assertNull($response->json('by_network.0.synced_conversions'));
        $this->assertNull($response->json('by_network.0.synced_commission'));
        $this->assertSame(1, $response->json('by_network.0.clicks'));

        // Now create synced report row
        AffiliateReport::create([
            'affiliate_network_id' => $network->id,
            'date' => now()->subDays(5)->toDateString(),
            'clicks' => 1,
            'conversions' => 4,
            'commission_amount' => 52.50,
            'synced_at' => now(),
        ]);

        $responseWithSync = $this->getJson('/api/admin/affiliate/reports?range=30')->assertOk();
        $this->assertTrue($responseWithSync->json('overview.has_synced_data'));
        $this->assertSame(4, $responseWithSync->json('overview.conversions_synced'));
        $this->assertSame(52.5, (float) $responseWithSync->json('overview.commission_amount_synced'));
        $this->assertSame(4, $responseWithSync->json('by_network.0.synced_conversions'));
        $this->assertSame(52.5, (float) $responseWithSync->json('by_network.0.synced_commission'));
    }

    public function test_reports_with_custom_date_range_filters_clicks_and_synced_reports(): void
    {
        Sanctum::actingAs($this->admin);

        $network = AffiliateNetwork::create([
            'name' => 'QA Custom Network',
            'slug' => 'qa-custom-net',
            'active' => true,
        ]);

        $category = BlogCategory::create(['name' => 'QA Cat', 'slug' => 'qa-cat']);
        $post = Post::create([
            'title' => 'QA Post',
            'slug' => 'qa-post',
            'content' => 'QA Content',
            'blog_category_id' => $category->id,
            'status' => 'draft',
        ]);

        // Click 1: 15 days ago (outside custom range)
        $click1 = new AffiliateClick([
            'affiliate_network_id' => $network->id,
            'post_id' => $post->id,
            'target_url' => 'https://example.com/item-1',
        ]);
        $click1->created_at = now()->subDays(15);
        $click1->save();

        // Click 2: 8 days ago (inside custom range 10d..5d)
        $click2 = new AffiliateClick([
            'affiliate_network_id' => $network->id,
            'post_id' => $post->id,
            'target_url' => 'https://example.com/item-2',
        ]);
        $click2->created_at = now()->subDays(8);
        $click2->save();

        // Click 3: 2 days ago (outside custom range)
        $click3 = new AffiliateClick([
            'affiliate_network_id' => $network->id,
            'post_id' => $post->id,
            'target_url' => 'https://example.com/item-3',
        ]);
        $click3->created_at = now()->subDays(2);
        $click3->save();

        // AffiliateReport 1: 15 days ago
        AffiliateReport::create([
            'affiliate_network_id' => $network->id,
            'date' => now()->subDays(15)->toDateString(),
            'clicks' => 1,
            'conversions' => 1,
            'commission_amount' => 10.00,
            'synced_at' => now(),
        ]);

        // AffiliateReport 2: 8 days ago (inside custom range)
        AffiliateReport::create([
            'affiliate_network_id' => $network->id,
            'date' => now()->subDays(8)->toDateString(),
            'clicks' => 1,
            'conversions' => 5,
            'commission_amount' => 50.00,
            'synced_at' => now(),
        ]);

        // AffiliateReport 3: 2 days ago
        AffiliateReport::create([
            'affiliate_network_id' => $network->id,
            'date' => now()->subDays(2)->toDateString(),
            'clicks' => 1,
            'conversions' => 2,
            'commission_amount' => 20.00,
            'synced_at' => now(),
        ]);

        $dateFrom = now()->subDays(10)->toDateString();
        $dateTo = now()->subDays(5)->toDateString();

        $response = $this->getJson("/api/admin/affiliate/reports?range=custom&date_from={$dateFrom}&date_to={$dateTo}")
            ->assertOk();

        $this->assertSame('custom', $response->json('range'));
        $this->assertSame($dateFrom, $response->json('date_from'));
        $this->assertSame($dateTo, $response->json('date_to'));

        // Fixed overview stats remain intact (all-time = 3, 7d = 1, 30d = 3)
        $this->assertSame(3, $response->json('overview.clicks_all_time'));
        $this->assertSame(1, $response->json('overview.clicks_7d'));
        $this->assertSame(3, $response->json('overview.clicks_30d'));

        // Synced metrics in range (only row 2: 5 conversions, 50.00 commission)
        $this->assertTrue($response->json('overview.has_synced_data'));
        $this->assertSame(5, $response->json('overview.conversions_synced'));
        $this->assertSame(50.0, (float) $response->json('overview.commission_amount_synced'));

        // by_network only counts click 2
        $this->assertCount(1, $response->json('by_network'));
        $this->assertSame(1, $response->json('by_network.0.clicks'));
        $this->assertSame(5, $response->json('by_network.0.synced_conversions'));
        $this->assertSame(50.0, (float) $response->json('by_network.0.synced_commission'));

        // by_post only counts click 2
        $this->assertCount(1, $response->json('by_post'));
        $this->assertSame(1, $response->json('by_post.0.clicks'));
    }

    public function test_reports_with_custom_range_requires_valid_date_from_and_date_to(): void
    {
        Sanctum::actingAs($this->admin);

        // Missing both
        $this->getJson('/api/admin/affiliate/reports?range=custom')
            ->assertStatus(422)
            ->assertJsonValidationErrors(['date_from', 'date_to']);

        // Missing date_to
        $this->getJson('/api/admin/affiliate/reports?range=custom&date_from=2026-01-01')
            ->assertStatus(422)
            ->assertJsonValidationErrors(['date_to']);

        // Missing date_from
        $this->getJson('/api/admin/affiliate/reports?range=custom&date_to=2026-01-01')
            ->assertStatus(422)
            ->assertJsonValidationErrors(['date_from']);

        // date_to before date_from
        $this->getJson('/api/admin/affiliate/reports?range=custom&date_from=2026-01-10&date_to=2026-01-05')
            ->assertStatus(422)
            ->assertJsonValidationErrors(['date_to']);
    }
}

