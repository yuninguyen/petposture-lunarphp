<?php

namespace Tests\Feature\Api\Admin;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Lunar\Models\Product;
use Lunar\Models\ProductType;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class ProductTypeControllerTest extends TestCase
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
        $this->getJson('/api/admin/product-types')->assertUnauthorized();
    }

    public function test_customer_cannot_list_product_types(): void
    {
        $customer = User::factory()->create();
        $customer->assignRole('customer');
        Sanctum::actingAs($customer);

        $this->getJson('/api/admin/product-types')->assertForbidden();
    }

    public function test_admin_list_includes_product_types_sorted_by_name_with_product_counts(): void
    {
        $this->actingAsAdmin();

        $general = ProductType::query()->firstOrCreate(['name' => 'General']);
        $harnesses = ProductType::query()->create(['name' => 'Harnesses']);

        Product::factory()->count(2)->create(['product_type_id' => $general->id]);
        Product::factory()->create(['product_type_id' => $harnesses->id]);

        $response = $this->getJson('/api/admin/product-types')->assertOk();

        $response->assertJsonPath('data.0.name', 'General')
            ->assertJsonPath('data.0.products_count', 2)
            ->assertJsonPath('data.1.name', 'Harnesses')
            ->assertJsonPath('data.1.products_count', 1);
        $this->assertCount(2, $response->json('data'));
    }

    public function test_admin_can_create_product_type_without_touching_existing_types_or_products(): void
    {
        $this->actingAsAdmin();

        $general = ProductType::query()->firstOrCreate(['name' => 'General']);
        $product = Product::factory()->create(['product_type_id' => $general->id]);

        $response = $this->postJson('/api/admin/product-types', [
            'name' => 'Harnesses',
        ])->assertCreated();

        $response->assertJsonPath('data.name', 'Harnesses')
            ->assertJsonPath('data.products_count', 0);
        $this->assertDatabaseHas('lunar_product_types', ['name' => 'Harnesses']);
        $this->assertSame(2, ProductType::query()->count());
        $this->assertSame(1, Product::query()->count());
        $this->assertSame($general->id, $product->fresh()->product_type_id);
    }

    public function test_admin_can_show_and_update_product_type_without_changing_product_count(): void
    {
        $this->actingAsAdmin();
        $productType = ProductType::query()->create(['name' => 'Harnesses']);

        $this->getJson('/api/admin/product-types/'.$productType->id)
            ->assertOk()
            ->assertJsonPath('data.name', 'Harnesses')
            ->assertJsonPath('data.products_count', 0);

        $this->putJson('/api/admin/product-types/'.$productType->id, ['name' => 'Orthopedic Beds'])
            ->assertOk()
            ->assertJsonPath('data.name', 'Orthopedic Beds')
            ->assertJsonPath('data.products_count', 0);

        $this->assertDatabaseHas('lunar_product_types', ['id' => $productType->id, 'name' => 'Orthopedic Beds']);
    }

    public function test_duplicate_name_is_rejected_when_updating_product_type(): void
    {
        $this->actingAsAdmin();
        $existing = ProductType::query()->create(['name' => 'Harnesses']);
        $productType = ProductType::query()->create(['name' => 'Beds']);

        $this->putJson('/api/admin/product-types/'.$productType->id, ['name' => $existing->name])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['name']);
    }

    public function test_admin_can_delete_unused_product_type(): void
    {
        $this->actingAsAdmin();
        $productType = ProductType::query()->create(['name' => 'Harnesses']);

        $this->deleteJson('/api/admin/product-types/'.$productType->id)->assertNoContent();

        $this->assertDatabaseMissing('lunar_product_types', ['id' => $productType->id]);
    }

    public function test_product_type_in_use_cannot_be_deleted(): void
    {
        $this->actingAsAdmin();
        $productType = ProductType::query()->create(['name' => 'Harnesses']);
        Product::factory()->create(['product_type_id' => $productType->id]);

        $this->deleteJson('/api/admin/product-types/'.$productType->id)
            ->assertStatus(409)
            ->assertJsonPath('code', 'PRODUCT_TYPE_IN_USE')
            ->assertJsonPath('details.products_count', 1);

        $this->assertDatabaseHas('lunar_product_types', ['id' => $productType->id]);
    }

    public function test_duplicate_name_is_rejected(): void
    {
        $this->actingAsAdmin();

        ProductType::query()->firstOrCreate(['name' => 'General']);

        $this->postJson('/api/admin/product-types', ['name' => 'General'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['name'])
            ->assertJsonPath('code', 'VALIDATION_ERROR');
    }

    private function actingAsAdmin(): User
    {
        $admin = User::factory()->create();
        $admin->assignRole('admin');
        Sanctum::actingAs($admin);

        return $admin;
    }
}
