<?php

declare(strict_types=1);

namespace Tests\Feature\Api\Admin;

use App\Models\OrderReturnRequest;
use App\Models\User;
use App\Security\AdminAbilityRegistry;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Lunar\Models\Channel;
use Lunar\Models\Currency;
use Lunar\Models\CustomerGroup;
use Lunar\Models\Language;
use Lunar\Models\Order;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

/**
 * Parity test suite for Phase 6b: Return Requests Domain Migration (Domain #25).
 *
 * Verifies exact 100% status code parity across all 7 roles for /return-requests endpoints:
 * - GET  /api/admin/return-requests (view_any_return_request)
 * - GET  /api/admin/return-requests/{id} (view_return_request)
 * - POST /api/admin/return-requests/{id}/preview (view_return_request)
 * - POST /api/admin/return-requests/{id}/tracking (update_return_request)
 * - POST /api/admin/return-requests/{id}/approve-low-value-waiver (approve_return_request)
 * - POST /api/admin/return-requests/{id}/approve (approve_return_request)
 * - POST /api/admin/return-requests/{id}/reject (reject_return_request)
 * - POST /api/admin/return-requests/{id}/complete (complete_return_request)
 *
 * Allowed: super_admin, admin, staff, Order Manager, Support
 * Blocked: Product Manager, customer
 */
class ReturnRequestsAbilityParityTest extends TestCase
{
    use RefreshDatabase;

    private const ALLOWED_ROLES = [
        'super_admin',
        'admin',
        'staff',
        'Order Manager',
        'Support',
    ];

    private const BLOCKED_ROLES = [
        'Product Manager',
        'customer',
    ];

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
    }

    public function test_allowed_roles_can_list_return_requests(): void
    {
        $this->createSimpleReturnRequest();

        foreach (self::ALLOWED_ROLES as $role) {
            $this->actingAsRole($role);

            $response = $this->getJson('/api/admin/return-requests');

            $response->assertOk(
                "Role '{$role}' must be permitted to list return requests (GET /api/admin/return-requests)."
            );
        }
    }

    public function test_blocked_roles_cannot_list_return_requests(): void
    {
        $this->createSimpleReturnRequest();

        foreach (self::BLOCKED_ROLES as $role) {
            $this->actingAsRole($role);

            $response = $this->getJson('/api/admin/return-requests');

            $response->assertForbidden(
                "Role '{$role}' must be forbidden from listing return requests (GET /api/admin/return-requests)."
            );
        }
    }

    public function test_allowed_roles_can_show_return_request(): void
    {
        $returnRequest = $this->createSimpleReturnRequest();

        foreach (self::ALLOWED_ROLES as $role) {
            $this->actingAsRole($role);

            $response = $this->getJson("/api/admin/return-requests/{$returnRequest->id}");

            $response->assertOk(
                "Role '{$role}' must be permitted to view return request (GET /api/admin/return-requests/{$returnRequest->id})."
            );
        }
    }

    public function test_blocked_roles_cannot_show_return_request(): void
    {
        $returnRequest = $this->createSimpleReturnRequest();

        foreach (self::BLOCKED_ROLES as $role) {
            $this->actingAsRole($role);

            $response = $this->getJson("/api/admin/return-requests/{$returnRequest->id}");

            $response->assertForbidden(
                "Role '{$role}' must be forbidden from viewing return request (GET /api/admin/return-requests/{$returnRequest->id})."
            );
        }
    }

    public function test_allowed_roles_pass_permission_check_for_all_mutation_and_action_endpoints(): void
    {
        // Tests that all mutation routes pass the EnforceAdminApiPermission gate for allowed roles
        // and reach the controller (which returns non-403, e.g. 404 for unknown record)
        $actions = [
            'approve' => ['rma_address' => '123 Return Dock'],
            'reject' => ['admin_note' => 'Rejected'],
            'complete' => [],
            'tracking' => ['tracking_number' => '1Z999'],
            'approve-low-value-waiver' => ['admin_note' => 'Waived'],
            'preview' => [],
        ];

        foreach (self::ALLOWED_ROLES as $role) {
            $this->actingAsRole($role);

            foreach ($actions as $action => $payload) {
                $response = $this->postJson("/api/admin/return-requests/999999/{$action}", $payload);

                $this->assertNotEquals(
                    403,
                    $response->status(),
                    "Role '{$role}' must NOT be forbidden by permission middleware for POST /api/admin/return-requests/999999/{$action}."
                );
                $this->assertSame(404, $response->status());
            }
        }
    }

    public function test_blocked_roles_are_forbidden_from_all_mutation_and_action_endpoints(): void
    {
        $actions = [
            'approve' => ['rma_address' => '123 Return Dock'],
            'reject' => ['admin_note' => 'Rejected'],
            'complete' => [],
            'tracking' => ['tracking_number' => '1Z999'],
            'approve-low-value-waiver' => ['admin_note' => 'Waived'],
            'preview' => [],
        ];

        foreach (self::BLOCKED_ROLES as $role) {
            $this->actingAsRole($role);

            foreach ($actions as $action => $payload) {
                $response = $this->postJson("/api/admin/return-requests/999999/{$action}", $payload);

                $response->assertForbidden(
                    "Role '{$role}' must be forbidden from POST /api/admin/return-requests/999999/{$action}."
                );
            }
        }
    }

    public function test_migration_seeds_and_assigns_return_requests_permissions(): void
    {
        $migration = require database_path('migrations/2026_09_22_000011_seed_return_requests_domain_permissions.php');
        $migration->up();

        // Core roles, Order Manager, and Support MUST have all return-request permissions
        foreach (['admin', 'staff', 'Order Manager', 'Support'] as $roleName) {
            $role = Role::query()->where('name', $roleName)->where('guard_name', 'web')->first();
            $this->assertNotNull($role);

            foreach (AdminAbilityRegistry::RETURN_REQUESTS as $permission) {
                $this->assertTrue(
                    $role->hasPermissionTo($permission),
                    "Role '{$roleName}' must have permission '{$permission}'."
                );
            }
        }

        // Product Manager MUST NOT have return-request permissions
        $pm = Role::query()->where('name', 'Product Manager')->where('guard_name', 'web')->first();
        $this->assertNotNull($pm);

        foreach (AdminAbilityRegistry::RETURN_REQUESTS as $permission) {
            $this->assertFalse(
                $pm->hasPermissionTo($permission),
                "Product Manager must NOT have permission '{$permission}'."
            );
        }
    }

    public function test_unauthenticated_request_is_unauthorized(): void
    {
        $this->getJson('/api/admin/return-requests')->assertUnauthorized();
        $this->getJson('/api/admin/return-requests/1')->assertUnauthorized();
        $this->postJson('/api/admin/return-requests/1/approve')->assertUnauthorized();
        $this->postJson('/api/admin/return-requests/1/reject')->assertUnauthorized();
        $this->postJson('/api/admin/return-requests/1/complete')->assertUnauthorized();
        $this->postJson('/api/admin/return-requests/1/tracking')->assertUnauthorized();
        $this->postJson('/api/admin/return-requests/1/approve-low-value-waiver')->assertUnauthorized();
        $this->postJson('/api/admin/return-requests/1/preview')->assertUnauthorized();
    }

    private function actingAsRole(string $role): User
    {
        $user = User::factory()->create();
        $user->assignRole($role);
        Sanctum::actingAs($user);

        return $user;
    }

    private function createSimpleReturnRequest(): OrderReturnRequest
    {
        $this->setUpLunarPrerequisites();

        $order = Order::factory()->create([
            'status' => 'delivered',
            'channel_id' => Channel::getDefault()->id,
            'currency_code' => Currency::getDefault()->code,
            'customer_reference' => 'guest@petposture.com',
            'sub_total' => 10000,
            'total' => 10000,
            'tax_total' => 0,
            'discount_total' => 0,
        ]);

        return OrderReturnRequest::query()->create([
            'order_id' => $order->id,
            'status' => OrderReturnRequest::STATUS_REQUESTED,
            'reason' => 'Defective',
            'customer_note' => 'Please refund quickly.',
            'requested_at' => now(),
        ]);
    }

    private function setUpLunarPrerequisites(): void
    {
        Language::firstOrCreate(
            ['code' => 'en'],
            ['name' => 'English', 'default' => true]
        );

        Currency::firstOrCreate(
            ['code' => 'USD'],
            [
                'name' => 'US Dollar',
                'decimal_places' => 2,
                'default' => true,
                'enabled' => true,
                'exchange_rate' => 1,
            ]
        );

        Channel::firstOrCreate(
            ['handle' => 'webstore'],
            [
                'name' => 'Webstore',
                'default' => true,
                'url' => 'http://localhost',
            ]
        );

        CustomerGroup::firstOrCreate(
            ['handle' => 'default'],
            [
                'name' => 'Default Customer Group',
                'default' => true,
            ]
        );
    }
}
