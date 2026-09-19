<?php

declare(strict_types=1);

namespace Tests\Feature\Api\Admin;

use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Lunar\FieldTypes\Text;
use Lunar\Models\Product;
use Lunar\Models\ProductAssociation;
use Lunar\Models\ProductType;
use Lunar\Models\TaxClass;
use Tests\TestCase;

/**
 * Parity coverage for the product API permission boundary.
 *
 * A successful authorization may subsequently yield validation or model-not-found
 * responses; this suite deliberately isolates the middleware's authorization result.
 */
class ProductsAbilityParityTest extends TestCase
{
    use RefreshDatabase;

    private const ALLOWED_ROLES = ['super_admin', 'admin', 'staff', 'Product Manager'];

    private const BLOCKED_ROLES = ['Order Manager', 'Support', 'customer'];

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
    }

    public function test_allowed_roles_can_enter_every_product_api_route(): void
    {
        foreach (self::ALLOWED_ROLES as $role) {
            $this->actingAsRole($role);

            foreach ($this->productRequests() as [$method, $uri, $payload]) {
                $response = $this->{$method}($uri, $payload);

                $this->assertNotSame(403, $response->getStatusCode(), "Role '{$role}' must pass product authorization for {$method} {$uri}.");
                $this->assertNotSame(401, $response->getStatusCode(), "Role '{$role}' must be authenticated for {$method} {$uri}.");
            }
        }
    }

    public function test_blocked_roles_cannot_enter_any_product_api_route(): void
    {
        foreach (self::BLOCKED_ROLES as $role) {
            $this->actingAsRole($role);

            foreach ($this->productRequests() as [$method, $uri, $payload]) {
                $response = $this->{$method}($uri, $payload);

                $this->assertSame(403, $response->getStatusCode(), "Role '{$role}' must be forbidden from {$method} {$uri}.");
            }
        }
    }

    public function test_unauthenticated_requests_are_unauthorized_for_every_product_api_route(): void
    {
        foreach ($this->productRequests() as [$method, $uri, $payload]) {
            $this->{$method}($uri, $payload)->assertUnauthorized();
        }
    }

    private function productRequests(): array
    {
        $productType = ProductType::query()->firstOrCreate(['name' => 'Parity Product Type']);
        $taxClass = TaxClass::query()->firstOrCreate(['name' => 'Parity Tax Class']);
        $product = Product::query()->create([
            'product_type_id' => $productType->id,
            'status' => 'draft',
            'attribute_data' => ['name' => new Text('Parity product')],
        ]);
        $target = Product::query()->create([
            'product_type_id' => $productType->id,
            'status' => 'draft',
            'attribute_data' => ['name' => new Text('Parity target')],
        ]);
        $association = ProductAssociation::query()->create([
            'product_parent_id' => $product->id,
            'product_target_id' => $target->id,
            'type' => 'cross-sell',
        ]);
        $variant = $product->variants()->create([
            'tax_class_id' => $taxClass->id,
            'sku' => 'PARITY-VARIANT-'.uniqid(),
            'stock' => 0,
            'backorder' => 0,
            'purchasable' => 'always',
            'unit_quantity' => 1,
            'min_quantity' => 1,
            'quantity_increment' => 1,
            'shippable' => true,
        ]);

        return [
            ['getJson', '/api/admin/products', []],
            ['postJson', '/api/admin/products', []],
            ['getJson', "/api/admin/products/{$product->id}", []],
            ['putJson', "/api/admin/products/{$product->id}", []],
            ['deleteJson', "/api/admin/products/{$product->id}", []],
            ['postJson', '/api/admin/products/bulk-delete', []],
            ['postJson', '/api/admin/products/bulk-status', []],
            ['getJson', "/api/admin/products/{$product->id}/preview-url", []],
            ['getJson', "/api/admin/products/{$product->id}/associations", []],
            ['postJson', "/api/admin/products/{$product->id}/associations", []],
            ['deleteJson', "/api/admin/products/{$product->id}/associations/{$association->id}", []],
            ['postJson', "/api/admin/products/{$product->id}/options", []],
            ['postJson', "/api/admin/products/{$product->id}/variants/generate", []],
            ['putJson', "/api/admin/products/{$product->id}/variants/{$variant->id}", []],
            ['deleteJson', "/api/admin/products/{$product->id}/variants/{$variant->id}", []],
        ];
    }

    private function actingAsRole(string $role): User
    {
        $user = User::factory()->create();
        $user->assignRole($role);
        Sanctum::actingAs($user);

        return $user;
    }
}
