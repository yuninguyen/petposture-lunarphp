<?php

namespace Tests\Feature\Api\Admin;

use App\Models\AffiliateNetwork;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class AffiliateNetworkControllerTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Role::firstOrCreate(['name' => 'admin', 'guard_name' => 'web']);
        $user = User::factory()->create();
        $user->assignRole('admin');
        Sanctum::actingAs($user);
    }

    public function test_index_returns_only_active_networks(): void
    {
        // The affiliate_networks migration already seeds 5 active networks
        // (chewy, amazon, walmart, petco, petsmart).
        AffiliateNetwork::create(['name' => 'Retired Network', 'slug' => 'retired', 'active' => false]);

        $response = $this->getJson('/api/admin/affiliate-networks')->assertOk();

        $names = array_column($response->json(), 'name');
        $this->assertCount(5, $names);
        $this->assertNotContains('Retired Network', $names);
    }

    public function test_index_returns_bare_array_not_wrapped_in_data(): void
    {
        $response = $this->getJson('/api/admin/affiliate-networks')->assertOk();

        $this->assertIsArray($response->json());
        $this->assertArrayNotHasKey('data', $response->json());
    }

    public function test_index_only_returns_name_and_slug(): void
    {
        AffiliateNetwork::create(['name' => 'Target', 'slug' => 'target', 'active' => true, 'api_key' => 'secret']);

        $response = $this->getJson('/api/admin/affiliate-networks')->assertOk();

        $this->assertSame(['name', 'slug'], array_keys($response->json('0')));
        $this->assertStringNotContainsString('secret', $response->getContent());
    }

    public function test_index_orders_by_name(): void
    {
        $response = $this->getJson('/api/admin/affiliate-networks')->assertOk();

        $this->assertSame(
            ['Amazon', 'Chewy', 'PetSmart', 'Petco', 'Walmart'],
            array_column($response->json(), 'name')
        );
    }
}
