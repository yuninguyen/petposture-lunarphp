<?php

namespace Tests\Feature\Api\Admin;

use App\Models\ShippingMethod;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Lunar\Models\Order;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class ShippingMethodControllerTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        foreach (['super_admin', 'admin', 'staff', 'Product Manager', 'Order Manager', 'Support'] as $role) {
            Role::findOrCreate($role, 'web');
        }
    }

    public function test_core_admin_can_manage_shipping_methods_and_responses_have_the_contract_shape(): void
    {
        $this->actingAsCoreAdmin();
        $first = ShippingMethod::query()->where('code', 'standard')->firstOrFail();
        $second = ShippingMethod::query()->where('code', 'express')->firstOrFail();

        $list = $this->getJson('/api/admin/shipping-methods')->assertOk();
        $this->assertSame([$first->id, $second->id], array_column($list->json('data'), 'id'));
        $this->assertSame(
            ['id', 'code', 'name', 'eta', 'price', 'free_over', 'created_at', 'updated_at'],
            array_keys($list->json('data.0')),
        );

        $created = $this->postJson('/api/admin/shipping-methods', [
            'code' => 'next-day',
            'name' => 'Next Day Delivery',
            'eta' => 'Next business day',
            'price' => 29.99,
            'free_over' => 150,
        ])->assertCreated()
            ->assertJsonPath('data.code', 'next-day')
            ->assertJsonPath('data.price', '29.99');

        $id = $created->json('data.id');
        $this->getJson("/api/admin/shipping-methods/{$id}")
            ->assertOk()
            ->assertJsonPath('data.name', 'Next Day Delivery');

        $this->putJson("/api/admin/shipping-methods/{$id}", [
            'name' => 'Priority Delivery',
            'eta' => null,
            'price' => 34.50,
            'free_over' => null,
        ])->assertOk()
            ->assertJsonPath('data.code', 'next-day')
            ->assertJsonPath('data.name', 'Priority Delivery')
            ->assertJsonPath('data.price', '34.50');

        $this->deleteJson("/api/admin/shipping-methods/{$id}")->assertNoContent();
        $this->assertDatabaseMissing('shipping_methods', ['id' => $id]);
    }

    public function test_admin_price_update_is_reflected_by_the_public_shipping_rates_endpoint(): void
    {
        $this->actingAsCoreAdmin();
        $method = ShippingMethod::query()->where('code', 'express')->firstOrFail();

        $this->patchJson("/api/admin/shipping-methods/{$method->id}", [
            'name' => $method->name,
            'price' => 9.99,
        ])->assertOk();

        $this->getJson('/api/checkout/shipping-rates')
            ->assertOk()
            ->assertJsonPath('rates.1.id', 'express')
            ->assertJsonPath('rates.1.price_minor', 999);
    }

    public function test_create_and_update_validate_shipping_method_fields_and_reject_code_changes(): void
    {
        $this->actingAsCoreAdmin();
        $method = ShippingMethod::query()->where('code', 'standard')->firstOrFail();

        $this->postJson('/api/admin/shipping-methods', [
            'code' => 'not valid',
            'name' => '',
            'price' => -0.01,
            'free_over' => -1,
        ])->assertUnprocessable()
            ->assertJsonValidationErrors(['code', 'name', 'price', 'free_over']);

        $this->postJson('/api/admin/shipping-methods', [
            'code' => 'standard',
            'name' => 'Duplicate',
            'price' => 1,
        ])->assertUnprocessable()
            ->assertJsonValidationErrors('code');

        $this->patchJson("/api/admin/shipping-methods/{$method->id}", [
            'code' => 'renamed-code',
            'name' => 'Changed',
            'price' => -1,
            'free_over' => -1,
        ])->assertUnprocessable()
            ->assertJsonValidationErrors(['code', 'price', 'free_over']);

        $this->assertSame('standard', $method->refresh()->code);
    }

    public function test_put_rejects_empty_or_null_supplied_code_and_preserves_the_existing_code(): void
    {
        $this->actingAsCoreAdmin();
        $method = ShippingMethod::query()->where('code', 'standard')->firstOrFail();

        foreach ([null, '', '   '] as $code) {
            $this->putJson("/api/admin/shipping-methods/{$method->id}", [
                'code' => $code,
                'name' => 'Changed',
                'price' => 10,
            ])->assertUnprocessable()
                ->assertJsonValidationErrors('code');

            $this->assertSame('standard', $method->refresh()->code);
        }
    }

    public function test_patch_rejects_empty_or_null_supplied_code_and_preserves_the_existing_code(): void
    {
        $this->actingAsCoreAdmin();
        $method = ShippingMethod::query()->where('code', 'standard')->firstOrFail();

        foreach ([null, '', '   '] as $code) {
            $this->patchJson("/api/admin/shipping-methods/{$method->id}", [
                'code' => $code,
                'name' => 'Changed',
                'price' => 10,
            ])->assertUnprocessable()
                ->assertJsonValidationErrors('code');

            $this->assertSame('standard', $method->refresh()->code);
        }
    }

    public function test_delete_is_blocked_by_a_nonterminal_order_and_terminal_orders_do_not_block_deletion(): void
    {
        $this->actingAsCoreAdmin();
        $blocked = ShippingMethod::query()->create([
            'code' => 'active-order-method',
            'name' => 'Active Order Method',
            'price' => 10,
        ]);
        Order::factory()->create([
            'status' => 'processing',
            'meta' => ['shipping_method' => $blocked->code],
        ]);

        $this->deleteJson("/api/admin/shipping-methods/{$blocked->id}")
            ->assertConflict()
            ->assertJsonPath('data.code', $blocked->code)
            ->assertJsonPath('message', 'This shipping method cannot be deleted because it is used by a nonterminal order.');
        $this->assertDatabaseHas('shipping_methods', ['id' => $blocked->id]);

        $terminal = ShippingMethod::query()->create([
            'code' => 'historical-order-method',
            'name' => 'Historical Order Method',
            'price' => 10,
        ]);
        Order::factory()->create(['status' => 'delivered', 'meta' => ['shipping_method' => $terminal->code]]);
        Order::factory()->create(['status' => 'cancelled', 'meta' => ['shipping_method' => $terminal->code]]);

        $this->deleteJson("/api/admin/shipping-methods/{$terminal->id}")->assertNoContent();
        $this->assertDatabaseMissing('shipping_methods', ['id' => $terminal->id]);
    }

    public function test_noncore_admin_roles_are_forbidden_from_every_shipping_method_endpoint(): void
    {
        $method = ShippingMethod::query()->where('code', 'standard')->firstOrFail();
        $requests = [
            fn () => $this->getJson('/api/admin/shipping-methods'),
            fn () => $this->postJson('/api/admin/shipping-methods', ['code' => 'forbidden', 'name' => 'Forbidden', 'price' => 1]),
            fn () => $this->getJson("/api/admin/shipping-methods/{$method->id}"),
            fn () => $this->putJson("/api/admin/shipping-methods/{$method->id}", ['name' => 'Forbidden', 'price' => 1]),
            fn () => $this->patchJson("/api/admin/shipping-methods/{$method->id}", ['name' => 'Forbidden', 'price' => 1]),
            fn () => $this->deleteJson("/api/admin/shipping-methods/{$method->id}"),
        ];

        foreach (['Product Manager', 'Order Manager', 'Support'] as $role) {
            Sanctum::actingAs($this->userWithRole($role));

            foreach ($requests as $request) {
                $request()->assertForbidden();
            }
        }
    }

    private function actingAsCoreAdmin(): User
    {
        $user = $this->userWithRole('admin');
        Sanctum::actingAs($user);

        return $user;
    }

    private function userWithRole(string $role): User
    {
        $user = User::factory()->create();
        $user->assignRole($role);

        return $user;
    }
}
