<?php

namespace Tests\Feature\Api\Admin;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Laravel\Sanctum\Sanctum;
use Lunar\Models\Brand;
use Lunar\Models\Product;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class BrandControllerTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        Role::firstOrCreate(['name' => 'admin', 'guard_name' => 'web']);
        Role::firstOrCreate(['name' => 'customer', 'guard_name' => 'web']);
    }

    public function test_unauthenticated_request_is_rejected(): void
    {
        $this->getJson('/api/admin/brands')->assertUnauthorized();
    }

    public function test_customer_cannot_access_brands(): void
    {
        $customer = User::factory()->create();
        $customer->assignRole('customer');
        Sanctum::actingAs($customer);

        $this->getJson('/api/admin/brands')->assertForbidden();
    }

    public function test_index_lists_only_lunar_brands_sorted_with_product_counts(): void
    {
        $this->actingAsAdmin();
        $zulu = Brand::query()->create(['name' => 'Zulu']);
        $alpha = Brand::query()->create(['name' => 'Alpha']);
        Product::factory()->count(2)->create(['brand_id' => $alpha->id]);
        Brand::query()->whereNotIn('id', [$alpha->id, $zulu->id])->delete();

        $response = $this->getJson('/api/admin/brands')->assertOk();

        $response->assertJsonPath('data.0.name', 'Alpha')
            ->assertJsonPath('data.0.products_count', 2)
            ->assertJsonPath('data.1.name', 'Zulu')
            ->assertJsonPath('data.1.products_count', 0);
        $this->assertCount(2, $response->json('data'));
        $this->assertDatabaseCount('brands', 0);
    }

    public function test_create_and_update_validate_unique_name_without_touching_app_brands(): void
    {
        $this->actingAsAdmin();
        Brand::query()->create(['name' => 'Existing']);

        $this->postJson('/api/admin/brands', ['name' => 'Existing'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('name');

        $created = $this->postJson('/api/admin/brands', ['name' => 'New Brand'])
            ->assertCreated()
            ->assertJsonPath('data.name', 'New Brand')
            ->assertJsonPath('data.products_count', 0);

        $id = $created->json('data.id');
        $this->putJson("/api/admin/brands/{$id}", ['name' => 'Existing'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('name');

        $this->putJson("/api/admin/brands/{$id}", ['name' => 'Renamed'])
            ->assertOk()
            ->assertJsonPath('data.name', 'Renamed');

        $this->assertDatabaseHas('lunar_brands', ['id' => $id, 'name' => 'Renamed']);
        $this->assertDatabaseCount('brands', 0);
    }

    public function test_delete_is_blocked_when_soft_deleted_product_uses_brand(): void
    {
        $this->actingAsAdmin();
        $brand = Brand::query()->create(['name' => 'Used']);
        $product = Product::factory()->create(['brand_id' => $brand->id]);
        $product->delete();

        $this->deleteJson("/api/admin/brands/{$brand->id}")
            ->assertConflict()
            ->assertJsonPath('code', 'BRAND_IN_USE')
            ->assertJsonPath('details.brand_id', $brand->id)
            ->assertJsonPath('details.products_count', 1);

        $this->assertDatabaseHas('lunar_brands', ['id' => $brand->id]);
    }

    public function test_unused_brand_can_be_deleted(): void
    {
        $this->actingAsAdmin();
        $brand = Brand::query()->create(['name' => 'Unused']);

        $this->deleteJson("/api/admin/brands/{$brand->id}")->assertNoContent();

        $this->assertDatabaseMissing('lunar_brands', ['id' => $brand->id]);
    }

    public function test_cache_is_invalidated_after_create_update_and_delete(): void
    {
        $this->actingAsAdmin();

        Cache::put('brands:index', 'cached');
        $created = $this->postJson('/api/admin/brands', ['name' => 'Cache Brand'])->assertCreated();
        $this->assertFalse(Cache::has('brands:index'));

        $id = $created->json('data.id');
        Cache::put('brands:index', 'cached');
        $this->putJson("/api/admin/brands/{$id}", ['name' => 'Cache Brand Updated'])->assertOk();
        $this->assertFalse(Cache::has('brands:index'));

        Cache::put('brands:index', 'cached');
        $this->deleteJson("/api/admin/brands/{$id}")->assertNoContent();
        $this->assertFalse(Cache::has('brands:index'));
    }

    private function actingAsAdmin(): User
    {
        $admin = User::factory()->create();
        $admin->assignRole('admin');
        Sanctum::actingAs($admin);

        return $admin;
    }
}
