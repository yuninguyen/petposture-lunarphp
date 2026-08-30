<?php

namespace Tests\Feature\Api\Admin;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Lunar\Models\Address;
use Lunar\Models\Customer;
use Lunar\Models\Order;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class CustomerControllerTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        foreach (['super_admin', 'admin', 'staff', 'Product Manager', 'Order Manager', 'Support'] as $role) {
            Role::findOrCreate($role, 'web');
        }
    }

    public function test_core_admin_lists_only_the_slim_customer_contract_with_filament_equivalent_aggregates(): void
    {
        $customer = $this->customer('Taylor', 'Customer');
        $user = User::factory()->create(['email' => 'taylor@example.test', 'is_active' => true]);
        $customer->users()->attach($user);
        Order::factory()->create(['customer_id' => $customer->id, 'total' => 12999]);

        $response = $this->asCoreAdmin()->getJson('/api/admin/customers');

        $response->assertOk()
            ->assertJsonPath('data.0.id', $customer->id)
            ->assertJsonPath('data.0.name', 'Taylor Customer')
            ->assertJsonPath('data.0.email', 'taylor@example.test')
            ->assertJsonPath('data.0.orders_count', 1)
            ->assertJsonPath('data.0.orders_sum_total', 12999)
            ->assertJsonPath('data.0.status', 'active')
            ->assertJsonStructure(['data' => [[
                'id', 'name', 'email', 'orders_count', 'orders_sum_total', 'created_at', 'status',
            ]], 'meta' => ['current_page', 'last_page', 'per_page', 'total']]);
        $this->assertSame(
            ['id', 'name', 'email', 'orders_count', 'orders_sum_total', 'created_at', 'status'],
            array_keys($response->json('data.0')),
        );
    }

    public function test_guest_customers_are_active_and_have_a_null_email(): void
    {
        $guest = $this->customer('Guest', 'Customer');

        $response = $this->asCoreAdmin()->getJson('/api/admin/customers');

        $response->assertOk()
            ->assertJsonPath('data.0.id', $guest->id)
            ->assertJsonPath('data.0.email', null)
            ->assertJsonPath('data.0.status', 'active');
    }

    public function test_list_is_newest_first_and_page_two_has_the_remaining_paginator_records(): void
    {
        $customers = [];

        for ($number = 1; $number <= 17; $number++) {
            $customers[] = $this->customer('Customer', (string) $number);
            $customers[$number - 1]->update(['created_at' => now()->subMinutes(18 - $number)]);
        }

        $pageOne = $this->asCoreAdmin()->getJson('/api/admin/customers');
        $pageTwo = $this->getJson('/api/admin/customers?page=2');

        $pageOne->assertOk()
            ->assertJsonPath('data.0.id', $customers[16]->id)
            ->assertJsonPath('data.14.id', $customers[2]->id)
            ->assertJsonPath('meta.current_page', 1)
            ->assertJsonPath('meta.last_page', 2)
            ->assertJsonPath('meta.per_page', 15)
            ->assertJsonPath('meta.total', 17);
        $pageTwo->assertOk()
            ->assertJsonPath('meta.current_page', 2)
            ->assertJsonPath('meta.last_page', 2)
            ->assertJsonPath('meta.per_page', 15)
            ->assertJsonPath('meta.total', 17);
        $this->assertSame([$customers[1]->id, $customers[0]->id], array_column($pageTwo->json('data'), 'id'));
    }

    public function test_status_filters_follow_filament_user_status_semantics(): void
    {
        $active = $this->customer('Active', 'Customer');
        $active->users()->attach(User::factory()->create(['is_active' => true]));

        $inactive = $this->customer('Inactive', 'Customer');
        $inactive->users()->attach(User::factory()->create(['is_active' => false]));

        $guest = $this->customer('Guest', 'Customer');

        $activeResponse = $this->asCoreAdmin()->getJson('/api/admin/customers?status=active');
        $inactiveResponse = $this->asCoreAdmin()->getJson('/api/admin/customers?status=inactive');

        $this->assertEqualsCanonicalizing([$active->id, $guest->id], array_column($activeResponse->json('data'), 'id'));
        $this->assertSame([$inactive->id], array_column($inactiveResponse->json('data'), 'id'));
    }

    public function test_customer_with_active_and_inactive_accounts_is_only_included_by_the_inactive_filter(): void
    {
        $customer = $this->customer('Mixed', 'Accounts');
        $customer->users()->attach(User::factory()->create(['is_active' => true]));
        $customer->users()->attach(User::factory()->create(['is_active' => false]));

        $activeResponse = $this->asCoreAdmin()->getJson('/api/admin/customers?status=active');
        $inactiveResponse = $this->getJson('/api/admin/customers?status=inactive');

        $activeResponse->assertOk()->assertJsonCount(0, 'data');
        $this->assertSame([$customer->id], array_column($inactiveResponse->json('data'), 'id'));
    }

    public function test_search_matches_customer_names_and_linked_user_emails(): void
    {
        $nameMatch = $this->customer('Taylor', 'Customer');
        $emailMatch = $this->customer('Other', 'Person');
        $emailMatch->users()->attach(User::factory()->create(['email' => 'find-me@example.test']));
        $this->customer('No', 'Match');

        $nameResponse = $this->asCoreAdmin()->getJson('/api/admin/customers?search=Taylor');
        $emailResponse = $this->asCoreAdmin()->getJson('/api/admin/customers?search=find-me%40example.test');

        $this->assertSame([$nameMatch->id], array_column($nameResponse->json('data'), 'id'));
        $this->assertSame([$emailMatch->id], array_column($emailResponse->json('data'), 'id'));
    }

    public function test_status_scope_is_not_bypassed_by_a_matching_search_term(): void
    {
        $inactive = $this->customer('Inactive', 'Taylor');
        $inactive->users()->attach(User::factory()->create(['is_active' => false]));

        $response = $this->asCoreAdmin()->getJson('/api/admin/customers?status=active&search=Inactive%20Taylor');

        $response->assertOk()->assertJsonCount(0, 'data');
    }

    public function test_non_core_roles_cannot_access_the_customer_list(): void
    {
        foreach (['Order Manager', 'Support', 'Product Manager'] as $role) {
            Sanctum::actingAs($this->userWithRole($role));

            $this->getJson('/api/admin/customers')->assertForbidden();
        }
    }

    public function test_each_permitted_core_role_can_access_the_customer_list(): void
    {
        foreach (['super_admin', 'admin', 'staff'] as $role) {
            Sanctum::actingAs($this->userWithRole($role));

            $this->getJson('/api/admin/customers')->assertOk();
        }
    }

    public function test_customer_mutation_routes_do_not_exist(): void
    {
        $this->asCoreAdmin();

        foreach ([
            fn () => $this->postJson('/api/admin/customers', []),
            fn () => $this->putJson('/api/admin/customers/1', []),
            fn () => $this->patchJson('/api/admin/customers/1', []),
            fn () => $this->deleteJson('/api/admin/customers/1'),
        ] as $request) {
            $this->assertContains($request()->getStatusCode(), [404, 405]);
        }
    }

    public function test_customer_summary_uses_the_list_contract_without_loading_tab_data(): void
    {
        $customer = $this->customer('Taylor', 'Customer');
        $customer->users()->attach(User::factory()->create(['email' => 'taylor@example.test', 'is_active' => true]));
        Order::factory()->create(['customer_id' => $customer->id, 'total' => 12999]);
        Address::factory()->create(['customer_id' => $customer->id]);

        $response = $this->asCoreAdmin()->getJson("/api/admin/customers/{$customer->id}");

        $response->assertOk()
            ->assertJsonPath('id', $customer->id)
            ->assertJsonPath('name', 'Taylor Customer')
            ->assertJsonPath('email', 'taylor@example.test')
            ->assertJsonPath('orders_count', 1)
            ->assertJsonPath('orders_sum_total', 12999)
            ->assertJsonPath('status', 'active');
        $this->assertSame(
            ['id', 'name', 'email', 'orders_count', 'orders_sum_total', 'created_at', 'status'],
            array_keys($response->json()),
        );
    }

    public function test_customer_orders_are_newest_first_paginated_and_expose_only_summaries(): void
    {
        $customer = $this->customer('Order', 'Customer');
        $orders = [];

        for ($number = 1; $number <= 16; $number++) {
            $orders[] = Order::factory()->create([
                'customer_id' => $customer->id,
                'reference' => "ORDER-{$number}",
                'status' => 'shipped',
                'total' => 12999,
                'currency_code' => 'USD',
                'notes' => 'private note',
                'meta' => ['internal_note' => 'secret'],
                'created_at' => now()->subMinutes(17 - $number),
            ]);
        }

        $response = $this->asCoreAdmin()->getJson("/api/admin/customers/{$customer->id}/orders?page=2");

        $response->assertOk()
            ->assertJsonPath('meta.current_page', 2)
            ->assertJsonPath('meta.last_page', 2)
            ->assertJsonPath('meta.per_page', 15)
            ->assertJsonPath('meta.total', 16)
            ->assertJsonPath('data.0.id', (string) $orders[0]->id)
            ->assertJsonPath('data.0.reference', 'ORDER-1')
            ->assertJsonPath('data.0.status', 'shipped')
            ->assertJsonPath('data.0.status_label', 'Shipped')
            ->assertJsonPath('data.0.total.decimal', 129.99)
            ->assertJsonPath('data.0.total.currency', 'USD')
            ->assertJsonStructure(['data' => [[
                'id', 'reference', 'status', 'status_label', 'total' => ['formatted', 'decimal', 'currency'], 'created_at',
            ]], 'meta' => ['current_page', 'last_page', 'per_page', 'total']]);
        $this->assertSame(
            ['id', 'reference', 'status', 'status_label', 'total', 'created_at'],
            array_keys($response->json('data.0')),
        );
    }

    public function test_customer_addresses_expose_contact_email_and_only_the_address_book_contract(): void
    {
        $customer = $this->customer('Address', 'Customer');
        $address = Address::factory()->create([
            'customer_id' => $customer->id,
            'contact_email' => 'address@example.test',
            'contact_phone' => '555-0100',
            'shipping_default' => true,
            'billing_default' => true,
            'meta' => ['sensitive' => 'metadata'],
        ]);
        Address::factory()->create([
            'customer_id' => $customer->id,
            'shipping_default' => false,
            'billing_default' => false,
        ]);

        $response = $this->asCoreAdmin()->getJson("/api/admin/customers/{$customer->id}/addresses");
        $addressData = collect($response->json('data'))->firstWhere('id', $address->id);

        $response->assertOk();
        $this->assertSame('address@example.test', $addressData['contact_email']);
        $this->assertTrue($addressData['shipping_default']);
        $this->assertTrue($addressData['billing_default']);
        $this->assertSame(
            ['id', 'title', 'first_name', 'last_name', 'line_one', 'line_two', 'line_three', 'city', 'state', 'postcode', 'contact_phone', 'contact_email', 'shipping_default', 'billing_default', 'created_at'],
            array_keys($addressData),
        );
    }

    public function test_customer_login_accounts_expose_only_id_and_email(): void
    {
        $customer = $this->customer('Accounts', 'Customer');
        $customer->users()->attach(User::factory()->create(['email' => 'first@example.test', 'is_active' => false]));
        $customer->users()->attach(User::factory()->create(['email' => 'second@example.test']));

        $response = $this->asCoreAdmin()->getJson("/api/admin/customers/{$customer->id}/login-accounts");

        $response->assertOk()->assertJsonCount(2, 'data');
        $this->assertSame(['id', 'email'], array_keys($response->json('data.0')));
        $this->assertSame(['id', 'email'], array_keys($response->json('data.1')));
    }

    public function test_non_core_roles_cannot_access_customer_summary_or_tabs(): void
    {
        $customer = $this->customer('Restricted', 'Customer');
        $paths = [
            "/api/admin/customers/{$customer->id}",
            "/api/admin/customers/{$customer->id}/orders",
            "/api/admin/customers/{$customer->id}/addresses",
            "/api/admin/customers/{$customer->id}/login-accounts",
        ];

        foreach (['Order Manager', 'Support', 'Product Manager'] as $role) {
            foreach ($paths as $path) {
                Sanctum::actingAs($this->userWithRole($role));

                $this->getJson($path)->assertForbidden();
            }
        }
    }

    private function asCoreAdmin(): static
    {
        Sanctum::actingAs($this->userWithRole('admin'));

        return $this;
    }

    private function customer(string $firstName, string $lastName): Customer
    {
        return Customer::factory()->create([
            'first_name' => $firstName,
            'last_name' => $lastName,
        ]);
    }

    private function userWithRole(string $role): User
    {
        $user = User::factory()->create();
        $user->assignRole($role);

        return $user;
    }
}
