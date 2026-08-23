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
