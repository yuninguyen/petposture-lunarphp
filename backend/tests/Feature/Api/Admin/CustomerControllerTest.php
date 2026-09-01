<?php

namespace Tests\Feature\Api\Admin;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Illuminate\Support\Facades\Hash;
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


    public function test_customer_summary_exposes_the_detail_profile_contract_without_loading_tab_data(): void
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
            ['id', 'name', 'email', 'orders_count', 'orders_sum_total', 'created_at', 'status', 'first_name', 'last_name', 'company_name', 'tax_identifier', 'phone'],
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
            ->assertJsonPath('data.0.total.formatted', '$129.99')
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

    public function test_each_core_role_can_mutate_customer_details_and_addresses(): void
    {
        foreach (['super_admin', 'admin', 'staff'] as $role) {
            $customer = $this->customer('Before', 'Customer');
            $address = Address::factory()->create(['customer_id' => $customer->id]);
            Sanctum::actingAs($this->userWithRole($role));

            $this->putJson("/api/admin/customers/{$customer->id}", ['first_name' => 'Updated'])
                ->assertOk()
                ->assertJsonPath('first_name', 'Updated');
            $this->patchJson("/api/admin/customers/{$customer->id}/addresses/{$address->id}", ['city' => 'Updated City'])
                ->assertOk()
                ->assertJsonPath('city', 'Updated City');
            $this->deleteJson("/api/admin/customers/{$customer->id}/addresses/{$address->id}")
                ->assertNoContent();
        }
    }

    public function test_order_manager_support_and_product_manager_receive_403_for_every_customer_mutation(): void
    {
        $customer = $this->customer('Restricted', 'Customer');
        $address = Address::factory()->create(['customer_id' => $customer->id]);

        foreach (['Order Manager', 'Support', 'Product Manager'] as $role) {
            Sanctum::actingAs($this->userWithRole($role));

            $this->putJson("/api/admin/customers/{$customer->id}", ['first_name' => 'Blocked'])->assertForbidden();
            $this->patchJson("/api/admin/customers/{$customer->id}", ['first_name' => 'Blocked'])->assertForbidden();
            $this->putJson("/api/admin/customers/{$customer->id}/addresses/{$address->id}", ['city' => 'Blocked'])->assertForbidden();
            $this->patchJson("/api/admin/customers/{$customer->id}/addresses/{$address->id}", ['city' => 'Blocked'])->assertForbidden();
            $this->deleteJson("/api/admin/customers/{$customer->id}/addresses/{$address->id}")->assertForbidden();
        }
    }

    public function test_customer_details_update_only_customer_profile_fields_and_keeps_contacts_read_only(): void
    {
        $customer = $this->customer('Before', 'Customer');
        $user = User::factory()->create(['email' => 'linked@example.test']);
        $customer->users()->attach($user);
        $address = Address::factory()->create([
            'customer_id' => $customer->id,
            'contact_phone' => '555-0100',
        ]);

        $response = $this->asCoreAdmin()->patchJson("/api/admin/customers/{$customer->id}", [
            'first_name' => 'After',
            'last_name' => 'Profile',
            'company_name' => 'Pet Posture Ltd',
            'tax_identifier' => 'TAX-123',
            'email' => 'should-not-write@example.test',
            'phone' => '555-9999',
            'unexpected' => 'ignored',
        ]);

        $response->assertOk()
            ->assertJsonPath('first_name', 'After')
            ->assertJsonPath('last_name', 'Profile')
            ->assertJsonPath('company_name', 'Pet Posture Ltd')
            ->assertJsonPath('tax_identifier', 'TAX-123')
            ->assertJsonPath('email', 'linked@example.test')
            ->assertJsonPath('phone', '555-0100');
        $this->assertSame('After', $customer->refresh()->first_name);
        $this->assertSame('Profile', $customer->last_name);
        $this->assertSame('Pet Posture Ltd', $customer->company_name);
        $this->assertSame('TAX-123', $customer->tax_identifier);
        $this->assertSame('linked@example.test', $user->refresh()->email);
        $this->assertSame('555-0100', $address->refresh()->contact_phone);
    }

    public function test_address_update_accepts_the_full_address_book_field_contract(): void
    {
        $customer = $this->customer('Address', 'Owner');
        $address = Address::factory()->create(['customer_id' => $customer->id]);
        $payload = [
            'title' => 'Home', 'first_name' => 'Ada', 'last_name' => 'Lovelace',
            'line_one' => '1 First Street', 'line_two' => 'Apartment 2', 'line_three' => 'Building A',
            'city' => 'London', 'state' => 'Greater London', 'postcode' => 'E1 6AN',
            'contact_phone' => '555-0111', 'contact_email' => 'ada@example.test',
            'shipping_default' => true, 'billing_default' => true,
        ];

        $this->asCoreAdmin()->putJson("/api/admin/customers/{$customer->id}/addresses/{$address->id}", $payload)
            ->assertOk()
            ->assertJson($payload);

        $this->assertSame($payload['line_three'], $address->refresh()->line_three);
        $this->assertTrue($address->shipping_default);
        $this->assertTrue($address->billing_default);
    }

    public function test_address_update_and_delete_reject_an_address_owned_by_another_customer(): void
    {
        $customer = $this->customer('First', 'Customer');
        $otherAddress = Address::factory()->create(['customer_id' => $this->customer('Second', 'Customer')->id]);

        $this->asCoreAdmin()->patchJson("/api/admin/customers/{$customer->id}/addresses/{$otherAddress->id}", ['city' => 'Hijacked'])
            ->assertNotFound();
        $this->deleteJson("/api/admin/customers/{$customer->id}/addresses/{$otherAddress->id}")
            ->assertNotFound();
        $this->assertDatabaseHas('lunar_addresses', ['id' => $otherAddress->id]);
    }

    public function test_customer_details_show_exposes_read_only_profile_email_and_first_address_phone(): void
    {
        $customer = $this->customer('Detail', 'Customer');
        $customer->update(['company_name' => 'Pet Posture', 'tax_identifier' => 'TAX-456']);
        $customer->users()->attach(User::factory()->create(['email' => 'first@example.test']));
        $customer->users()->attach(User::factory()->create(['email' => 'second@example.test']));
        $firstAddress = Address::factory()->create(['customer_id' => $customer->id, 'contact_phone' => '555-0101']);
        Address::factory()->create(['customer_id' => $customer->id, 'contact_phone' => '555-0102']);

        $response = $this->asCoreAdmin()->getJson("/api/admin/customers/{$customer->id}");

        $response->assertOk()
            ->assertJsonPath('first_name', 'Detail')
            ->assertJsonPath('last_name', 'Customer')
            ->assertJsonPath('company_name', 'Pet Posture')
            ->assertJsonPath('tax_identifier', 'TAX-456')
            ->assertJsonPath('email', 'first@example.test')
            ->assertJsonPath('phone', '555-0101');
        $this->assertSame($firstAddress->id, $customer->addresses()->orderBy('id')->first()->id);
    }

    public function test_customer_details_show_returns_null_phone_when_the_customer_has_no_addresses(): void
    {
        $customer = $this->customer('No', 'Address');

        $this->asCoreAdmin()->getJson("/api/admin/customers/{$customer->id}")
            ->assertOk()
            ->assertJsonPath('phone', null);
    }

    public function test_each_core_role_can_update_a_belonging_login_account_via_put_and_patch(): void
    {
        foreach (['super_admin', 'admin', 'staff'] as $role) {
            $customer = $this->customer('Account', 'Owner');
            $user = User::factory()->create(['email' => "{$role}@before.test"]);
            $customer->users()->attach($user);
            Sanctum::actingAs($this->userWithRole($role));

            foreach (['putJson', 'patchJson'] as $method) {
                $email = "{$role}-{$method}@after.test";
                $response = $this->{$method}("/api/admin/customers/{$customer->id}/login-accounts/{$user->id}", [
                    'email' => $email,
                ]);

                $response->assertOk()->assertJsonPath('data.id', $user->id)->assertJsonPath('data.email', $email);
                $this->assertSame(['id', 'email'], array_keys($response->json('data')));
            }
        }
    }

    public function test_non_core_roles_receive_403_for_every_login_account_mutation_method(): void
    {
        $customer = $this->customer('Restricted', 'Account');
        $user = User::factory()->create();
        $customer->users()->attach($user);

        foreach (['Order Manager', 'Support', 'Product Manager'] as $role) {
            Sanctum::actingAs($this->userWithRole($role));

            $this->putJson("/api/admin/customers/{$customer->id}/login-accounts/{$user->id}", ['email' => 'blocked-put@example.test'])
                ->assertForbidden();
            $this->patchJson("/api/admin/customers/{$customer->id}/login-accounts/{$user->id}", ['email' => 'blocked-patch@example.test'])
                ->assertForbidden();
        }
    }

    public function test_login_account_mutation_returns_404_when_the_user_belongs_to_another_customer(): void
    {
        $customer = $this->customer('First', 'Customer');
        $otherUser = User::factory()->create(['email' => 'other@example.test']);
        $this->customer('Second', 'Customer')->users()->attach($otherUser);

        $this->asCoreAdmin()->patchJson("/api/admin/customers/{$customer->id}/login-accounts/{$otherUser->id}", [
            'email' => 'hijacked@example.test',
        ])->assertNotFound();

        $this->assertSame('other@example.test', $otherUser->refresh()->email);
    }

    public function test_login_account_email_validation_excludes_the_current_user_and_rejects_another_users_email(): void
    {
        $customer = $this->customer('Email', 'Owner');
        $user = User::factory()->create(['email' => 'account@example.test']);
        $otherUser = User::factory()->create(['email' => 'taken@example.test']);
        $customer->users()->attach($user);

        $this->asCoreAdmin()->putJson("/api/admin/customers/{$customer->id}/login-accounts/{$user->id}", [
            'email' => 'account@example.test',
        ])->assertOk();

        $this->patchJson("/api/admin/customers/{$customer->id}/login-accounts/{$user->id}", [
            'email' => $otherUser->email,
        ])->assertUnprocessable()->assertJsonValidationErrors('email');
    }

    public function test_core_admin_login_account_mutation_rejects_a_missing_email(): void
    {
        $customer = $this->customer('Missing', 'Email');
        $user = User::factory()->create();
        $customer->users()->attach($user);

        $this->asCoreAdmin()->patchJson("/api/admin/customers/{$customer->id}/login-accounts/{$user->id}", [])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('email');
    }

    public function test_core_admin_login_account_mutation_rejects_a_malformed_email(): void
    {
        $customer = $this->customer('Malformed', 'Email');
        $user = User::factory()->create();
        $customer->users()->attach($user);

        $this->asCoreAdmin()->putJson("/api/admin/customers/{$customer->id}/login-accounts/{$user->id}", [
            'email' => 'not-an-email',
        ])->assertUnprocessable()->assertJsonValidationErrors('email');
    }

    public function test_login_account_password_validation_rejects_mismatches_and_short_passwords(): void
    {
        $customer = $this->customer('Password', 'Owner');
        $user = User::factory()->create();
        $customer->users()->attach($user);

        $this->asCoreAdmin()->putJson("/api/admin/customers/{$customer->id}/login-accounts/{$user->id}", [
            'email' => $user->email,
            'password' => 'valid-password',
            'password_confirmation' => 'different-password',
        ])->assertUnprocessable()->assertJsonValidationErrors('password');

        $this->patchJson("/api/admin/customers/{$customer->id}/login-accounts/{$user->id}", [
            'email' => $user->email,
            'password' => 'short',
            'password_confirmation' => 'short',
        ])->assertUnprocessable()->assertJsonValidationErrors('password');
    }

    public function test_core_admin_login_account_mutation_rejects_matching_password_arrays(): void
    {
        $customer = $this->customer('Array', 'Password');
        $user = User::factory()->create();
        $customer->users()->attach($user);
        $password = array_fill(0, 8, 'password');

        $this->asCoreAdmin()->patchJson("/api/admin/customers/{$customer->id}/login-accounts/{$user->id}", [
            'email' => $user->email,
            'password' => $password,
            'password_confirmation' => $password,
        ])->assertUnprocessable()->assertJsonValidationErrors('password');
    }

    public function test_login_account_omitted_or_blank_password_preserves_the_existing_hash(): void
    {
        $customer = $this->customer('Preserve', 'Password');
        $user = User::factory()->create(['password' => Hash::make('original-password')]);
        $customer->users()->attach($user);
        $originalHash = $user->password;

        $this->asCoreAdmin()->putJson("/api/admin/customers/{$customer->id}/login-accounts/{$user->id}", [
            'email' => 'omitted@example.test',
        ])->assertOk();
        $this->assertSame($originalHash, $user->refresh()->password);

        $this->patchJson("/api/admin/customers/{$customer->id}/login-accounts/{$user->id}", [
            'email' => 'blank@example.test',
            'password' => '   ',
            'password_confirmation' => '   ',
        ])->assertOk();
        $this->assertSame($originalHash, $user->refresh()->password);
    }

    public function test_login_account_supplied_password_is_hashed_and_the_response_is_slim(): void
    {
        $customer = $this->customer('Reset', 'Password');
        $user = User::factory()->create(['email' => 'before@example.test', 'password' => Hash::make('original-password')]);
        $customer->users()->attach($user);

        $response = $this->asCoreAdmin()->patchJson("/api/admin/customers/{$customer->id}/login-accounts/{$user->id}", [
            'email' => 'after@example.test',
            'password' => 'replacement-password',
            'password_confirmation' => 'replacement-password',
        ]);

        $response->assertOk()->assertJsonPath('data.id', $user->id)->assertJsonPath('data.email', 'after@example.test');
        $this->assertSame(['id', 'email'], array_keys($response->json('data')));
        $this->assertTrue(Hash::check('replacement-password', $user->refresh()->password));
        $this->assertFalse(Hash::check('original-password', $user->password));
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
