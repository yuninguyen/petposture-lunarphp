<?php

declare(strict_types=1);

namespace Tests\Unit\Security;

use App\Models\User;
use App\Security\AdminAbilityRegistry;
use PHPUnit\Framework\TestCase;

/**
 * Unit tests for AdminAbilityRegistry.
 *
 * Verifies 100% parity with pre-Phase-6a permission matrix and route/middleware gates.
 * Ensures effective access of all roles does not change by even 1 bit.
 */
class AdminAbilityRegistryTest extends TestCase
{
    public function test_it_registers_all_40_domains_with_complete_metadata(): void
    {
        $domains = AdminAbilityRegistry::domains();

        $this->assertCount(40, $domains, 'Must register exactly 40 admin domains.');

        for ($i = 1; $i <= 40; $i++) {
            $this->assertArrayHasKey($i, $domains, "Domain #{$i} must be present in registry.");
            $entry = $domains[$i];

            $this->assertSame($i, $entry['id']);
            $this->assertNotEmpty($entry['key']);
            $this->assertNotEmpty($entry['route_prefix']);
            $this->assertNotEmpty($entry['access_type']);
            $this->assertNotEmpty($entry['abilities']);
            $this->assertNotEmpty($entry['allowed_roles']);

            foreach ($entry['abilities'] as $ability) {
                $this->assertIsString($ability);
                $this->assertNotEmpty(trim($ability));
            }

            foreach ($entry['allowed_roles'] as $role) {
                $this->assertIsString($role);
                $this->assertNotEmpty(trim($role));
            }
        }
    }

    public function test_it_can_lookup_domains_by_id_or_key(): void
    {
        $byId = AdminAbilityRegistry::domain(1);
        $this->assertNotNull($byId);
        $this->assertSame('dashboard/sales', $byId['key']);

        $byKey = AdminAbilityRegistry::domain('dashboard/sales');
        $this->assertNotNull($byKey);
        $this->assertSame(1, $byKey['id']);

        $byPrefix = AdminAbilityRegistry::domain('settings/smtp');
        $this->assertNotNull($byPrefix);
        $this->assertSame(36, $byPrefix['id']);

        $this->assertNull(AdminAbilityRegistry::domain(999));
        $this->assertNull(AdminAbilityRegistry::domain('non_existent_key'));
    }

    public function test_it_identifies_core_and_non_core_roles_correctly(): void
    {
        $this->assertSame(['super_admin', 'admin', 'staff'], AdminAbilityRegistry::coreRoles());
        $this->assertSame(['Product Manager', 'Order Manager', 'Support'], AdminAbilityRegistry::nonCoreRoles());
        $this->assertSame(User::ADMIN_PANEL_ROLES, AdminAbilityRegistry::adminRoles());

        $this->assertTrue(AdminAbilityRegistry::isCoreAdminRole('super_admin'));
        $this->assertTrue(AdminAbilityRegistry::isCoreAdminRole('admin'));
        $this->assertTrue(AdminAbilityRegistry::isCoreAdminRole('staff'));

        $this->assertFalse(AdminAbilityRegistry::isCoreAdminRole('Product Manager'));
        $this->assertFalse(AdminAbilityRegistry::isCoreAdminRole('Order Manager'));
        $this->assertFalse(AdminAbilityRegistry::isCoreAdminRole('Support'));
        $this->assertFalse(AdminAbilityRegistry::isCoreAdminRole('customer'));
        $this->assertFalse(AdminAbilityRegistry::isCoreAdminRole('guest'));
    }

    public function test_all_abilities_is_strictly_sorted_and_unique(): void
    {
        $abilities = AdminAbilityRegistry::allAbilities();

        $this->assertNotEmpty($abilities);
        $this->assertSame($abilities, array_values(array_unique($abilities)), 'Abilities list must be unique.');

        $sorted = $abilities;
        sort($sorted);
        $this->assertSame($sorted, $abilities, 'Abilities list must be sorted alphabetically.');
    }

    public function test_core_roles_have_all_abilities(): void
    {
        $all = AdminAbilityRegistry::allAbilities();

        foreach (AdminAbilityRegistry::coreRoles() as $coreRole) {
            $roleAbilities = AdminAbilityRegistry::abilitiesForRole($coreRole);
            $this->assertSame($all, $roleAbilities, "Core role '{$coreRole}' must possess all registered abilities.");

            $this->assertTrue(AdminAbilityRegistry::roleHasAbility($coreRole, 'refund_order'));
            $this->assertTrue(AdminAbilityRegistry::roleHasAbility($coreRole, 'delete_review'));
            $this->assertTrue(AdminAbilityRegistry::roleHasAbility($coreRole, 'delete_order'));
            $this->assertTrue(AdminAbilityRegistry::roleHasAbility($coreRole, 'view_general_settings'));
            $this->assertTrue(AdminAbilityRegistry::roleHasAbility($coreRole, 'create_system_user'));
            $this->assertTrue(AdminAbilityRegistry::roleHasAbility($coreRole, 'delete_any_discount'));
        }
    }

    public function test_customer_and_unrecognized_roles_have_zero_abilities(): void
    {
        $this->assertSame([], AdminAbilityRegistry::abilitiesForRole('customer'));
        $this->assertSame([], AdminAbilityRegistry::abilitiesForRole('guest'));
        $this->assertSame([], AdminAbilityRegistry::abilitiesForRole('unknown_role'));
        $this->assertSame([], AdminAbilityRegistry::abilitiesForRole(''));

        $this->assertFalse(AdminAbilityRegistry::roleHasAbility('customer', 'view_any_order'));
        $this->assertFalse(AdminAbilityRegistry::roleHasAbility('customer', 'view_profile'));
        $this->assertFalse(AdminAbilityRegistry::roleHasAbility('guest', 'view_any_product'));
    }

    public function test_product_manager_abilities_and_strict_exclusions(): void
    {
        $role = 'Product Manager';
        $abilities = AdminAbilityRegistry::abilitiesForRole($role);
        $this->assertNotEmpty($abilities);

        // Granted: Catalogue domains (12 - 19)
        $catalogueAbilities = [
            'view_any_brand', 'create_brand', 'update_brand', 'delete_brand',
            'view_any_collection_group', 'create_collection_group', 'update_collection_group',
            'view_any_collection', 'create_collection', 'update_collection', 'reorder_collection',
            'view_any_product', 'view_product', 'create_product', 'update_product', 'delete_product', 'publish_product',
            'view_any_product_type', 'create_product_type', 'update_product_type',
            'view_any_custom_field', 'create_custom_field', 'update_custom_field',
            'view_any_breed', 'create_breed', 'update_breed', 'delete_breed',
            'view_any_solution', 'create_solution', 'update_solution', 'delete_solution',
        ];

        foreach ($catalogueAbilities as $ability) {
            $this->assertTrue(
                AdminAbilityRegistry::roleHasAbility($role, $ability),
                "Product Manager must have ability '{$ability}'."
            );
        }

        // Granted: Reviews (view, create, update)
        $this->assertTrue(AdminAbilityRegistry::roleHasAbility($role, 'view_any_review'));
        $this->assertTrue(AdminAbilityRegistry::roleHasAbility($role, 'view_review'));
        $this->assertTrue(AdminAbilityRegistry::roleHasAbility($role, 'create_review'));
        $this->assertTrue(AdminAbilityRegistry::roleHasAbility($role, 'update_review'));

        // Granted: Profile & Notifications
        $this->assertTrue(AdminAbilityRegistry::roleHasAbility($role, 'view_profile'));
        $this->assertTrue(AdminAbilityRegistry::roleHasAbility($role, 'update_profile'));
        $this->assertTrue(AdminAbilityRegistry::roleHasAbility($role, 'update_profile_password'));
        $this->assertTrue(AdminAbilityRegistry::roleHasAbility($role, 'view_any_notification'));

        // CRITICAL EXCLUSION: Delete Review is Core-Only
        $this->assertFalse(
            AdminAbilityRegistry::roleHasAbility($role, 'delete_review'),
            'Product Manager MUST NOT have delete_review (core-only).'
        );
        $this->assertFalse(
            AdminAbilityRegistry::roleHasAbility($role, 'delete_any_review'),
            'Product Manager MUST NOT have delete_any_review (core-only).'
        );

        // CRITICAL EXCLUSIONS: No Orders / Returns / Dashboard
        $this->assertFalse(AdminAbilityRegistry::roleHasAbility($role, 'view_any_order'));
        $this->assertFalse(AdminAbilityRegistry::roleHasAbility($role, 'refund_order'));
        $this->assertFalse(AdminAbilityRegistry::roleHasAbility($role, 'view_any_return_request'));
        $this->assertFalse(AdminAbilityRegistry::roleHasAbility($role, 'view_dashboard_sales'));
        $this->assertFalse(AdminAbilityRegistry::roleHasAbility($role, 'view_dashboard_conversion'));

        // CRITICAL EXCLUSIONS: No Posts / Comments / Blog Categories (fast-path-only domains)
        $this->assertFalse(AdminAbilityRegistry::roleHasAbility($role, 'view_any_post'));
        $this->assertFalse(AdminAbilityRegistry::roleHasAbility($role, 'view_any_comment'));
        $this->assertFalse(AdminAbilityRegistry::roleHasAbility($role, 'view_any_blog_category'));

        // CRITICAL EXCLUSIONS: No System / Settings / Role-gated
        $this->assertFalse(AdminAbilityRegistry::roleHasAbility($role, 'view_any_system_user'));
        $this->assertFalse(AdminAbilityRegistry::roleHasAbility($role, 'view_any_role'));
        $this->assertFalse(AdminAbilityRegistry::roleHasAbility($role, 'view_any_customer'));
        $this->assertFalse(AdminAbilityRegistry::roleHasAbility($role, 'view_general_settings'));
        $this->assertFalse(AdminAbilityRegistry::roleHasAbility($role, 'view_any_payment_method'));
        $this->assertFalse(AdminAbilityRegistry::roleHasAbility($role, 'view_any_discount'));
    }

    public function test_order_manager_abilities_and_strict_exclusions(): void
    {
        $role = 'Order Manager';

        // Granted: Dashboard sales & conversion
        $this->assertTrue(AdminAbilityRegistry::roleHasAbility($role, 'view_dashboard_sales'));
        $this->assertTrue(AdminAbilityRegistry::roleHasAbility($role, 'view_dashboard_conversion'));

        // Granted: Orders (including refund_order)
        $this->assertTrue(AdminAbilityRegistry::roleHasAbility($role, 'view_any_order'));
        $this->assertTrue(AdminAbilityRegistry::roleHasAbility($role, 'view_order'));
        $this->assertTrue(AdminAbilityRegistry::roleHasAbility($role, 'create_order'));
        $this->assertTrue(AdminAbilityRegistry::roleHasAbility($role, 'update_order'));
        $this->assertTrue(
            AdminAbilityRegistry::roleHasAbility($role, 'refund_order'),
            'Order Manager MUST have refund_order.'
        );

        // Granted: Return Requests
        $this->assertTrue(AdminAbilityRegistry::roleHasAbility($role, 'view_any_return_request'));
        $this->assertTrue(AdminAbilityRegistry::roleHasAbility($role, 'view_return_request'));
        $this->assertTrue(AdminAbilityRegistry::roleHasAbility($role, 'approve_return_request'));
        $this->assertTrue(AdminAbilityRegistry::roleHasAbility($role, 'reject_return_request'));
        $this->assertTrue(AdminAbilityRegistry::roleHasAbility($role, 'complete_return_request'));

        // Granted: Profile & Notifications
        $this->assertTrue(AdminAbilityRegistry::roleHasAbility($role, 'view_profile'));
        $this->assertTrue(AdminAbilityRegistry::roleHasAbility($role, 'update_profile'));
        $this->assertTrue(AdminAbilityRegistry::roleHasAbility($role, 'update_profile_password'));
        $this->assertTrue(AdminAbilityRegistry::roleHasAbility($role, 'view_any_notification'));

        // CRITICAL EXCLUSION: Delete Order is Core-Only
        $this->assertFalse(
            AdminAbilityRegistry::roleHasAbility($role, 'delete_order'),
            'Order Manager MUST NOT have delete_order (core-only).'
        );
        $this->assertFalse(
            AdminAbilityRegistry::roleHasAbility($role, 'delete_any_order'),
            'Order Manager MUST NOT have delete_any_order (core-only).'
        );

        // CRITICAL EXCLUSIONS: No Catalogue / Products / Brands
        $this->assertFalse(AdminAbilityRegistry::roleHasAbility($role, 'view_any_product'));
        $this->assertFalse(AdminAbilityRegistry::roleHasAbility($role, 'view_any_brand'));
        $this->assertFalse(AdminAbilityRegistry::roleHasAbility($role, 'view_any_collection'));

        // CRITICAL EXCLUSIONS: No Reviews
        $this->assertFalse(AdminAbilityRegistry::roleHasAbility($role, 'view_any_review'));
        $this->assertFalse(AdminAbilityRegistry::roleHasAbility($role, 'delete_review'));

        // CRITICAL EXCLUSIONS: No System / Settings / Role-gated
        $this->assertFalse(AdminAbilityRegistry::roleHasAbility($role, 'view_any_system_user'));
        $this->assertFalse(AdminAbilityRegistry::roleHasAbility($role, 'view_any_role'));
        $this->assertFalse(AdminAbilityRegistry::roleHasAbility($role, 'view_any_customer'));
        $this->assertFalse(AdminAbilityRegistry::roleHasAbility($role, 'view_general_settings'));
        $this->assertFalse(AdminAbilityRegistry::roleHasAbility($role, 'view_any_payment_method'));
        $this->assertFalse(AdminAbilityRegistry::roleHasAbility($role, 'view_any_discount'));
    }

    public function test_support_abilities_and_strict_exclusions(): void
    {
        $role = 'Support';

        // Granted: Dashboard sales & conversion
        $this->assertTrue(AdminAbilityRegistry::roleHasAbility($role, 'view_dashboard_sales'));
        $this->assertTrue(AdminAbilityRegistry::roleHasAbility($role, 'view_dashboard_conversion'));

        // Granted: Orders (view, create, update)
        $this->assertTrue(AdminAbilityRegistry::roleHasAbility($role, 'view_any_order'));
        $this->assertTrue(AdminAbilityRegistry::roleHasAbility($role, 'view_order'));
        $this->assertTrue(AdminAbilityRegistry::roleHasAbility($role, 'create_order'));
        $this->assertTrue(AdminAbilityRegistry::roleHasAbility($role, 'update_order'));

        // Granted: Return Requests
        $this->assertTrue(AdminAbilityRegistry::roleHasAbility($role, 'view_any_return_request'));
        $this->assertTrue(AdminAbilityRegistry::roleHasAbility($role, 'view_return_request'));
        $this->assertTrue(AdminAbilityRegistry::roleHasAbility($role, 'approve_return_request'));
        $this->assertTrue(AdminAbilityRegistry::roleHasAbility($role, 'reject_return_request'));
        $this->assertTrue(AdminAbilityRegistry::roleHasAbility($role, 'complete_return_request'));

        // Granted: Reviews (view, create, update)
        $this->assertTrue(AdminAbilityRegistry::roleHasAbility($role, 'view_any_review'));
        $this->assertTrue(AdminAbilityRegistry::roleHasAbility($role, 'view_review'));
        $this->assertTrue(AdminAbilityRegistry::roleHasAbility($role, 'create_review'));
        $this->assertTrue(AdminAbilityRegistry::roleHasAbility($role, 'update_review'));

        // Granted: Profile & Notifications
        $this->assertTrue(AdminAbilityRegistry::roleHasAbility($role, 'view_profile'));
        $this->assertTrue(AdminAbilityRegistry::roleHasAbility($role, 'update_profile'));
        $this->assertTrue(AdminAbilityRegistry::roleHasAbility($role, 'update_profile_password'));
        $this->assertTrue(AdminAbilityRegistry::roleHasAbility($role, 'view_any_notification'));

        // SUBTLE FRONTEND EXCEPTION #1: Support MUST NOT have refund_order (Order Manager and Core only)
        $this->assertFalse(
            AdminAbilityRegistry::roleHasAbility($role, 'refund_order'),
            'Support MUST NOT have refund_order (Order Manager and Core only - see App.tsx canRefundOrders).'
        );

        // SUBTLE FRONTEND EXCEPTION #2: Support MUST NOT have delete_review (Core only)
        $this->assertFalse(
            AdminAbilityRegistry::roleHasAbility($role, 'delete_review'),
            'Support MUST NOT have delete_review (Core only - see ReviewsPage.tsx canDeleteReviews).'
        );
        $this->assertFalse(
            AdminAbilityRegistry::roleHasAbility($role, 'delete_any_review'),
            'Support MUST NOT have delete_any_review (Core only).'
        );

        // Other Core-only exclusions
        $this->assertFalse(AdminAbilityRegistry::roleHasAbility($role, 'delete_order'));
        $this->assertFalse(AdminAbilityRegistry::roleHasAbility($role, 'delete_any_order'));
        $this->assertFalse(AdminAbilityRegistry::roleHasAbility($role, 'view_any_product'));
        $this->assertFalse(AdminAbilityRegistry::roleHasAbility($role, 'view_any_system_user'));
        $this->assertFalse(AdminAbilityRegistry::roleHasAbility($role, 'view_any_customer'));
        $this->assertFalse(AdminAbilityRegistry::roleHasAbility($role, 'view_general_settings'));
        $this->assertFalse(AdminAbilityRegistry::roleHasAbility($role, 'view_any_discount'));
    }

    public function test_roles_have_ability_checks_multiple_roles(): void
    {
        // Support alone cannot refund
        $this->assertFalse(AdminAbilityRegistry::rolesHaveAbility(['Support', 'customer'], 'refund_order'));

        // Order Manager can refund
        $this->assertTrue(AdminAbilityRegistry::rolesHaveAbility(['Support', 'Order Manager'], 'refund_order'));

        // Neither Support nor Product Manager can delete review
        $this->assertFalse(AdminAbilityRegistry::rolesHaveAbility(['Support', 'Product Manager'], 'delete_review'));

        // Core admin can delete review
        $this->assertTrue(AdminAbilityRegistry::rolesHaveAbility(['Support', 'admin'], 'delete_review'));

        // Empty roles array
        $this->assertFalse(AdminAbilityRegistry::rolesHaveAbility([], 'view_profile'));
    }
}
