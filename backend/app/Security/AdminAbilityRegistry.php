<?php

declare(strict_types=1);

namespace App\Security;

use App\Models\User;

/**
 * Authoritative registry of all abilities across the 40 admin domains.
 *
 * Phase 6a: Pure data preparation. Not wired to routes, middleware,
 * or policies yet. Preserves effective access of all roles 100%.
 */
final class AdminAbilityRegistry
{
    // =========================================================================
    // 40 Domain Ability Sets
    // =========================================================================

    // 1. Dashboard Sales
    public const DASHBOARD_SALES = [
        'view_dashboard_sales',
    ];

    // 2. Dashboard Conversion
    public const DASHBOARD_CONVERSION = [
        'view_dashboard_conversion',
    ];

    // 3. Goals
    public const GOALS = [
        'view_any_goal',
        'update_goal',
    ];

    // 4. Profile & Password
    public const PROFILE = [
        'view_profile',
        'update_profile',
        'update_profile_password',
    ];

    // 5. System Users
    public const SYSTEM_USERS = [
        'view_any_system_user',
        'view_system_user',
        'create_system_user',
        'update_system_user',
        'delete_system_user',
    ];

    // 6. System Media
    public const SYSTEM_MEDIA = [
        'view_any_system_media',
        'delete_system_media',
    ];

    // 7. System Roles (matches RolePolicy)
    public const SYSTEM_ROLES = [
        'view_any_role',
        'view_role',
        'create_role',
        'update_role',
        'delete_role',
        'delete_any_role',
    ];

    // 8. System Activity Logs
    public const SYSTEM_ACTIVITY_LOGS = [
        'view_any_activity_log',
        'view_activity_log',
    ];

    // 9. Notifications
    public const NOTIFICATIONS = [
        'view_any_notification',
        'update_notification',
    ];

    // 10. Affiliate Reports
    public const AFFILIATE_REPORTS = [
        'view_any_affiliate_report',
        'view_affiliate_report',
    ];

    // 11. Affiliate Networks (Management CRUD & Sync)
    public const AFFILIATE_NETWORKS = [
        'view_any_affiliate_network',
        'view_affiliate_network',
        'create_affiliate_network',
        'update_affiliate_network',
        'delete_affiliate_network',
        'sync_affiliate_network',
    ];

    // 12. Brands (matches BrandPolicy)
    public const BRANDS = [
        'view_any_brand',
        'view_brand',
        'create_brand',
        'update_brand',
        'delete_brand',
        'delete_any_brand',
    ];

    // 13. Collection Groups
    public const COLLECTION_GROUPS = [
        'view_any_collection_group',
        'view_collection_group',
        'create_collection_group',
        'update_collection_group',
        'delete_collection_group',
        'delete_any_collection_group',
    ];

    // 14. Collections
    public const COLLECTIONS = [
        'view_any_collection',
        'view_collection',
        'create_collection',
        'update_collection',
        'delete_collection',
        'delete_any_collection',
        'reorder_collection',
        'move_collection',
    ];

    // 15. Products (matches ProductPolicy & AdminPermissionMatrix::PRODUCT)
    public const PRODUCTS = [
        'view_any_product',
        'view_product',
        'create_product',
        'update_product',
        'delete_product',
        'delete_any_product',
        'publish_product',
    ];

    // 16. Product Types
    public const PRODUCT_TYPES = [
        'view_any_product_type',
        'view_product_type',
        'create_product_type',
        'update_product_type',
        'delete_product_type',
    ];

    // 17. Custom Fields
    public const CUSTOM_FIELDS = [
        'view_any_custom_field',
        'view_custom_field',
        'create_custom_field',
        'update_custom_field',
        'delete_custom_field',
    ];

    // 18. Breeds (+ bulk delete)
    public const BREEDS = [
        'view_any_breed',
        'view_breed',
        'create_breed',
        'update_breed',
        'delete_breed',
        'delete_any_breed',
    ];

    // 19. Solutions (+ bulk delete)
    public const SOLUTIONS = [
        'view_any_solution',
        'view_solution',
        'create_solution',
        'update_solution',
        'delete_solution',
        'delete_any_solution',
    ];

    // 20. Reviews (matches ReviewPolicy & AdminPermissionMatrix::REVIEW)
    public const REVIEWS = [
        'view_any_review',
        'view_review',
        'create_review',
        'update_review',
        'delete_review',
        'delete_any_review',
    ];

    // 21. Posts (matches PostPolicy & AdminPermissionMatrix::POST)
    public const POSTS = [
        'view_any_post',
        'view_post',
        'create_post',
        'update_post',
        'delete_post',
        'delete_any_post',
        'publish_post',
        'duplicate_post',
        'generate_post_seo',
    ];

    // 22. Blog Categories (matches BlogCategoryPolicy)
    public const BLOG_CATEGORIES = [
        'view_any_blog_category',
        'view_blog_category',
        'create_blog_category',
        'update_blog_category',
        'delete_blog_category',
        'delete_any_blog_category',
        'view_any_blog::category',
        'view_blog::category',
        'create_blog::category',
        'update_blog::category',
        'delete_blog::category',
        'delete_any_blog::category',
    ];

    // 23. Comments (matches CommentPolicy)
    public const COMMENTS = [
        'view_any_comment',
        'view_comment',
        'create_comment',
        'update_comment',
        'delete_comment',
        'delete_any_comment',
        'approve_comment',
    ];

    // 24. Blog Tags
    public const BLOG_TAGS = [
        'view_any_blog_tag',
        'view_blog_tag',
        'create_blog_tag',
        'update_blog_tag',
        'delete_blog_tag',
        'delete_any_blog_tag',
    ];

    // 25. Users (Legacy GET /api/admin/users)
    public const USERS = [
        'view_any_user',
        'view_user',
    ];

    // 26. Orders (matches OrderPolicy & AdminPermissionMatrix::ORDER)
    public const ORDERS = [
        'view_any_order',
        'view_order',
        'create_order',
        'update_order',
        'delete_order',
        'delete_any_order',
        'refund_order',
    ];

    // 27. Return Requests
    public const RETURN_REQUESTS = [
        'view_any_return_request',
        'view_return_request',
        'update_return_request',
        'approve_return_request',
        'reject_return_request',
        'complete_return_request',
    ];

    // 28. Media Library (matches MediaPolicy)
    public const MEDIA = [
        'view_any_media',
        'view_media',
        'create_media',
        'update_media',
        'delete_media',
        'delete_any_media',
    ];

    // 29. Affiliate Networks Selector (GET /api/admin/affiliate-networks)
    public const AFFILIATE_NETWORKS_SELECTOR = [
        'view_affiliate_network_selector',
    ];

    // 30. SEO & Social
    public const SEO_SOCIAL = [
        'view_seo_social',
        'update_seo_social',
    ];

    // 31. Pages / Legal & Policies (matches PagePolicy)
    public const PAGES = [
        'view_any_page',
        'view_page',
        'create_page',
        'update_page',
        'delete_page',
        'delete_any_page',
    ];

    // 32. Customers (Role-gated at route level)
    public const CUSTOMERS = [
        'view_any_customer',
        'view_customer',
        'create_customer',
        'update_customer',
        'delete_customer',
        'delete_any_customer',
    ];

    // 33. Settings General (matches SettingPolicy)
    public const SETTINGS_GENERAL = [
        'view_general_settings',
        'update_general_settings',
        'view_any_setting',
        'update_setting',
    ];

    // 34. Settings Branding
    public const SETTINGS_BRANDING = [
        'view_branding_settings',
        'update_branding_settings',
    ];

    // 35. Settings Analytics
    public const SETTINGS_ANALYTICS = [
        'view_analytics_settings',
        'update_analytics_settings',
    ];

    // 36. Settings SMTP
    public const SETTINGS_SMTP = [
        'view_smtp_settings',
        'update_smtp_settings',
        'test_smtp_settings',
    ];

    // 37. Settings AI
    public const SETTINGS_AI = [
        'view_ai_settings',
        'update_ai_settings',
        'test_ai_settings',
    ];

    // 38. Finance Payment Methods
    public const FINANCE_PAYMENT_METHODS = [
        'view_any_payment_method',
        'view_payment_method',
        'update_payment_method',
        'test_payment_method',
    ];

    // 39. Shipping Methods
    public const SHIPPING_METHODS = [
        'view_any_shipping_method',
        'view_shipping_method',
        'create_shipping_method',
        'update_shipping_method',
        'delete_shipping_method',
        'delete_any_shipping_method',
    ];

    // 40. Discounts
    public const DISCOUNTS = [
        'view_any_discount',
        'view_discount',
        'create_discount',
        'update_discount',
        'delete_discount',
        'delete_any_discount',
    ];

    // =========================================================================
    // Domain Catalog (1 - 40 Ground Truth)
    // =========================================================================

    /**
     * Complete inventory of all 40 admin domains with route prefixes,
     * abilities, and current effective role access.
     *
     * @return array<int, array{
     *     id: int,
     *     key: string,
     *     route_prefix: string,
     *     access_type: string,
     *     abilities: list<string>,
     *     allowed_roles: list<string>
     * }>
     */
    public static function domains(): array
    {
        return [
            1 => [
                'id' => 1,
                'key' => 'dashboard/sales',
                'route_prefix' => 'dashboard/sales',
                'access_type' => 'mw-ability',
                'abilities' => self::DASHBOARD_SALES,
                'allowed_roles' => ['super_admin', 'admin', 'staff', 'Order Manager', 'Support'],
            ],
            2 => [
                'id' => 2,
                'key' => 'dashboard/conversion',
                'route_prefix' => 'dashboard/conversion',
                'access_type' => 'mw-ability',
                'abilities' => self::DASHBOARD_CONVERSION,
                'allowed_roles' => ['super_admin', 'admin', 'staff', 'Order Manager', 'Support'],
            ],
            3 => [
                'id' => 3,
                'key' => 'goals',
                'route_prefix' => 'goals',
                'access_type' => 'fast-path-only',
                'abilities' => self::GOALS,
                'allowed_roles' => ['super_admin', 'admin', 'staff'],
            ],
            4 => [
                'id' => 4,
                'key' => 'profile',
                'route_prefix' => 'profile',
                'access_type' => 'allowlist',
                'abilities' => self::PROFILE,
                'allowed_roles' => ['super_admin', 'admin', 'staff', 'Product Manager', 'Order Manager', 'Support'],
            ],
            5 => [
                'id' => 5,
                'key' => 'system/users',
                'route_prefix' => 'system/users',
                'access_type' => 'fast-path-only',
                'abilities' => self::SYSTEM_USERS,
                'allowed_roles' => ['super_admin', 'admin', 'staff'],
            ],
            6 => [
                'id' => 6,
                'key' => 'system/media',
                'route_prefix' => 'system/media',
                'access_type' => 'fast-path-only',
                'abilities' => self::SYSTEM_MEDIA,
                'allowed_roles' => ['super_admin', 'admin', 'staff'],
            ],
            7 => [
                'id' => 7,
                'key' => 'system/roles',
                'route_prefix' => 'system/roles',
                'access_type' => 'fast-path-only',
                'abilities' => self::SYSTEM_ROLES,
                'allowed_roles' => ['super_admin', 'admin', 'staff'],
            ],
            8 => [
                'id' => 8,
                'key' => 'system/activity-logs',
                'route_prefix' => 'system/activity-logs',
                'access_type' => 'fast-path-only',
                'abilities' => self::SYSTEM_ACTIVITY_LOGS,
                'allowed_roles' => ['super_admin', 'admin', 'staff'],
            ],
            9 => [
                'id' => 9,
                'key' => 'notifications',
                'route_prefix' => 'notifications',
                'access_type' => 'allowlist',
                'abilities' => self::NOTIFICATIONS,
                'allowed_roles' => ['super_admin', 'admin', 'staff', 'Product Manager', 'Order Manager', 'Support'],
            ],
            10 => [
                'id' => 10,
                'key' => 'affiliate/reports',
                'route_prefix' => 'affiliate/reports',
                'access_type' => 'fast-path-only',
                'abilities' => self::AFFILIATE_REPORTS,
                'allowed_roles' => ['super_admin', 'admin', 'staff'],
            ],
            11 => [
                'id' => 11,
                'key' => 'affiliate/networks',
                'route_prefix' => 'affiliate/networks',
                'access_type' => 'fast-path-only',
                'abilities' => self::AFFILIATE_NETWORKS,
                'allowed_roles' => ['super_admin', 'admin', 'staff'],
            ],
            12 => [
                'id' => 12,
                'key' => 'brands',
                'route_prefix' => 'brands',
                'access_type' => 'mw-ability',
                'abilities' => self::BRANDS,
                'allowed_roles' => ['super_admin', 'admin', 'staff', 'Product Manager'],
            ],
            13 => [
                'id' => 13,
                'key' => 'collection-groups',
                'route_prefix' => 'collection-groups',
                'access_type' => 'mw-ability',
                'abilities' => self::COLLECTION_GROUPS,
                'allowed_roles' => ['super_admin', 'admin', 'staff', 'Product Manager'],
            ],
            14 => [
                'id' => 14,
                'key' => 'collections',
                'route_prefix' => 'collections',
                'access_type' => 'mw-ability',
                'abilities' => self::COLLECTIONS,
                'allowed_roles' => ['super_admin', 'admin', 'staff', 'Product Manager'],
            ],
            15 => [
                'id' => 15,
                'key' => 'products',
                'route_prefix' => 'products',
                'access_type' => 'mw-ability',
                'abilities' => self::PRODUCTS,
                'allowed_roles' => ['super_admin', 'admin', 'staff', 'Product Manager'],
            ],
            16 => [
                'id' => 16,
                'key' => 'product-types',
                'route_prefix' => 'product-types',
                'access_type' => 'mw-ability',
                'abilities' => self::PRODUCT_TYPES,
                'allowed_roles' => ['super_admin', 'admin', 'staff', 'Product Manager'],
            ],
            17 => [
                'id' => 17,
                'key' => 'custom-fields',
                'route_prefix' => 'custom-fields',
                'access_type' => 'mw-ability',
                'abilities' => self::CUSTOM_FIELDS,
                'allowed_roles' => ['super_admin', 'admin', 'staff', 'Product Manager'],
            ],
            18 => [
                'id' => 18,
                'key' => 'breeds',
                'route_prefix' => 'breeds',
                'access_type' => 'mw-ability',
                'abilities' => self::BREEDS,
                'allowed_roles' => ['super_admin', 'admin', 'staff', 'Product Manager'],
            ],
            19 => [
                'id' => 19,
                'key' => 'solutions',
                'route_prefix' => 'solutions',
                'access_type' => 'mw-ability',
                'abilities' => self::SOLUTIONS,
                'allowed_roles' => ['super_admin', 'admin', 'staff', 'Product Manager'],
            ],
            20 => [
                'id' => 20,
                'key' => 'reviews',
                'route_prefix' => 'reviews',
                'access_type' => 'mw-ability',
                'abilities' => self::REVIEWS,
                'allowed_roles' => ['super_admin', 'admin', 'staff', 'Product Manager', 'Support'],
            ],
            21 => [
                'id' => 21,
                'key' => 'posts',
                'route_prefix' => 'posts',
                'access_type' => 'fast-path-only',
                'abilities' => self::POSTS,
                'allowed_roles' => ['super_admin', 'admin', 'staff'],
            ],
            22 => [
                'id' => 22,
                'key' => 'blog/categories',
                'route_prefix' => 'blog/categories',
                'access_type' => 'fast-path-only',
                'abilities' => self::BLOG_CATEGORIES,
                'allowed_roles' => ['super_admin', 'admin', 'staff'],
            ],
            23 => [
                'id' => 23,
                'key' => 'comments',
                'route_prefix' => 'comments',
                'access_type' => 'fast-path-only',
                'abilities' => self::COMMENTS,
                'allowed_roles' => ['super_admin', 'admin', 'staff'],
            ],
            24 => [
                'id' => 24,
                'key' => 'blog/tags',
                'route_prefix' => 'blog/tags',
                'access_type' => 'fast-path-only',
                'abilities' => self::BLOG_TAGS,
                'allowed_roles' => ['super_admin', 'admin', 'staff'],
            ],
            25 => [
                'id' => 25,
                'key' => 'users',
                'route_prefix' => 'users',
                'access_type' => 'fast-path-only',
                'abilities' => self::USERS,
                'allowed_roles' => ['super_admin', 'admin', 'staff'],
            ],
            26 => [
                'id' => 26,
                'key' => 'orders',
                'route_prefix' => 'orders',
                'access_type' => 'mw-ability',
                'abilities' => self::ORDERS,
                'allowed_roles' => ['super_admin', 'admin', 'staff', 'Order Manager', 'Support'],
            ],
            27 => [
                'id' => 27,
                'key' => 'return-requests',
                'route_prefix' => 'return-requests',
                'access_type' => 'mw-ability',
                'abilities' => self::RETURN_REQUESTS,
                'allowed_roles' => ['super_admin', 'admin', 'staff', 'Order Manager', 'Support'],
            ],
            28 => [
                'id' => 28,
                'key' => 'media',
                'route_prefix' => 'media',
                'access_type' => 'fast-path-only',
                'abilities' => self::MEDIA,
                'allowed_roles' => ['super_admin', 'admin', 'staff'],
            ],
            29 => [
                'id' => 29,
                'key' => 'affiliate-networks',
                'route_prefix' => 'affiliate-networks',
                'access_type' => 'fast-path-only',
                'abilities' => self::AFFILIATE_NETWORKS_SELECTOR,
                'allowed_roles' => ['super_admin', 'admin', 'staff'],
            ],
            30 => [
                'id' => 30,
                'key' => 'seo-social',
                'route_prefix' => 'seo-social',
                'access_type' => 'fast-path-only',
                'abilities' => self::SEO_SOCIAL,
                'allowed_roles' => ['super_admin', 'admin', 'staff'],
            ],
            31 => [
                'id' => 31,
                'key' => 'pages',
                'route_prefix' => 'pages',
                'access_type' => 'fast-path-only',
                'abilities' => self::PAGES,
                'allowed_roles' => ['super_admin', 'admin', 'staff'],
            ],
            32 => [
                'id' => 32,
                'key' => 'customers',
                'route_prefix' => 'customers',
                'access_type' => 'role-gated',
                'abilities' => self::CUSTOMERS,
                'allowed_roles' => ['super_admin', 'admin', 'staff'],
            ],
            33 => [
                'id' => 33,
                'key' => 'settings/general',
                'route_prefix' => 'settings/general',
                'access_type' => 'role-gated',
                'abilities' => self::SETTINGS_GENERAL,
                'allowed_roles' => ['super_admin', 'admin', 'staff'],
            ],
            34 => [
                'id' => 34,
                'key' => 'settings/branding',
                'route_prefix' => 'settings/branding',
                'access_type' => 'role-gated',
                'abilities' => self::SETTINGS_BRANDING,
                'allowed_roles' => ['super_admin', 'admin', 'staff'],
            ],
            35 => [
                'id' => 35,
                'key' => 'settings/analytics',
                'route_prefix' => 'settings/analytics',
                'access_type' => 'role-gated',
                'abilities' => self::SETTINGS_ANALYTICS,
                'allowed_roles' => ['super_admin', 'admin', 'staff'],
            ],
            36 => [
                'id' => 36,
                'key' => 'settings/smtp',
                'route_prefix' => 'settings/smtp',
                'access_type' => 'role-gated',
                'abilities' => self::SETTINGS_SMTP,
                'allowed_roles' => ['super_admin', 'admin', 'staff'],
            ],
            37 => [
                'id' => 37,
                'key' => 'settings/ai',
                'route_prefix' => 'settings/ai',
                'access_type' => 'role-gated',
                'abilities' => self::SETTINGS_AI,
                'allowed_roles' => ['super_admin', 'admin', 'staff'],
            ],
            38 => [
                'id' => 38,
                'key' => 'finance/payment-methods',
                'route_prefix' => 'finance/payment-methods',
                'access_type' => 'role-gated',
                'abilities' => self::FINANCE_PAYMENT_METHODS,
                'allowed_roles' => ['super_admin', 'admin', 'staff'],
            ],
            39 => [
                'id' => 39,
                'key' => 'shipping-methods',
                'route_prefix' => 'shipping-methods',
                'access_type' => 'role-gated',
                'abilities' => self::SHIPPING_METHODS,
                'allowed_roles' => ['super_admin', 'admin', 'staff'],
            ],
            40 => [
                'id' => 40,
                'key' => 'discounts',
                'route_prefix' => 'discounts',
                'access_type' => 'role-gated',
                'abilities' => self::DISCOUNTS,
                'allowed_roles' => ['super_admin', 'admin', 'staff'],
            ],
        ];
    }

    // =========================================================================
    // Core Role & Capability Helpers
    // =========================================================================

    /**
     * Core roles that have unconditional full administrative access.
     *
     * @return list<string>
     */
    public static function coreRoles(): array
    {
        return ['super_admin', 'admin', 'staff'];
    }

    /**
     * Non-core business roles with granular restricted access.
     *
     * @return list<string>
     */
    public static function nonCoreRoles(): array
    {
        return ['Product Manager', 'Order Manager', 'Support'];
    }

    /**
     * All recognized admin panel roles.
     *
     * @return list<string>
     */
    public static function adminRoles(): array
    {
        return User::ADMIN_PANEL_ROLES;
    }

    /**
     * Determine if a role is a core admin role.
     */
    public static function isCoreAdminRole(string $role): bool
    {
        return in_array($role, self::coreRoles(), true);
    }

    /**
     * Return all registered abilities across all 40 domains, sorted and deduplicated.
     *
     * @return list<string>
     */
    public static function allAbilities(): array
    {
        $all = [];
        foreach (self::domains() as $domain) {
            foreach ($domain['abilities'] as $ability) {
                $all[$ability] = true;
            }
        }

        $list = array_keys($all);
        sort($list);

        return $list;
    }

    /**
     * Return the exact effective ability set granted to a role.
     *
     * Guarantees 100% parity with the pre-Phase-6a permission matrix and
     * middleware/route access model:
     * - super_admin, admin, staff: ALL abilities across all 40 domains.
     * - Product Manager: Catalogue domains (12-19), Reviews (view/create/update, NO delete), Profile (4), Notifications (9).
     * - Order Manager: Dashboard (1-2), Orders (26, including refund), Return Requests (27), Profile (4), Notifications (9).
     * - Support: Dashboard (1-2), Orders (26, NO refund, NO delete), Return Requests (27), Reviews (view/create/update, NO delete), Profile (4), Notifications (9).
     * - customer, guest, or unrecognized role: [] (no abilities).
     *
     * @return list<string>
     */
    public static function abilitiesForRole(string $role): array
    {
        if (self::isCoreAdminRole($role)) {
            return self::allAbilities();
        }

        $abilities = match ($role) {
            'Product Manager' => [
                // Domain 4: Profile
                ...self::PROFILE,
                // Domain 9: Notifications
                ...self::NOTIFICATIONS,
                // Domains 12-19: Catalogue
                ...self::BRANDS,
                ...self::COLLECTION_GROUPS,
                ...self::COLLECTIONS,
                ...self::PRODUCTS,
                ...self::PRODUCT_TYPES,
                ...self::CUSTOM_FIELDS,
                ...self::BREEDS,
                ...self::SOLUTIONS,
                // Domain 20: Reviews (granular: view/create/update only — NO delete)
                'view_any_review',
                'view_review',
                'create_review',
                'update_review',
            ],

            'Order Manager' => [
                // Domains 1-2: Dashboard
                ...self::DASHBOARD_SALES,
                ...self::DASHBOARD_CONVERSION,
                // Domain 4: Profile
                ...self::PROFILE,
                // Domain 9: Notifications
                ...self::NOTIFICATIONS,
                // Domain 26: Orders (Order Manager has refund_order; delete is core-only)
                'view_any_order',
                'view_order',
                'create_order',
                'update_order',
                'refund_order',
                // Domain 27: Return Requests
                ...self::RETURN_REQUESTS,
            ],

            'Support' => [
                // Domains 1-2: Dashboard
                ...self::DASHBOARD_SALES,
                ...self::DASHBOARD_CONVERSION,
                // Domain 4: Profile
                ...self::PROFILE,
                // Domain 9: Notifications
                ...self::NOTIFICATIONS,
                // Domain 20: Reviews (granular: view/create/update only — NO delete)
                'view_any_review',
                'view_review',
                'create_review',
                'update_review',
                // Domain 26: Orders (Support has view/create/update — NO refund_order, NO delete_order)
                'view_any_order',
                'view_order',
                'create_order',
                'update_order',
                // Domain 27: Return Requests
                ...self::RETURN_REQUESTS,
            ],

            default => [],
        };

        if (empty($abilities)) {
            return [];
        }

        $unique = array_values(array_unique($abilities));
        sort($unique);

        return $unique;
    }

    /**
     * Determine if a single role has a specific ability.
     */
    public static function roleHasAbility(string $role, string $ability): bool
    {
        if (self::isCoreAdminRole($role)) {
            return in_array($ability, self::allAbilities(), true);
        }

        return in_array($ability, self::abilitiesForRole($role), true);
    }

    /**
     * Determine if any of the provided roles grants a specific ability.
     *
     * @param list<string> $roles
     */
    public static function rolesHaveAbility(array $roles, string $ability): bool
    {
        foreach ($roles as $role) {
            if (self::roleHasAbility($role, $ability)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Look up a domain record by its 1-based index or string route key.
     *
     * @return array{
     *     id: int,
     *     key: string,
     *     route_prefix: string,
     *     access_type: string,
     *     abilities: list<string>,
     *     allowed_roles: list<string>
     * }|null
     */
    public static function domain(int|string $key): ?array
    {
        $domains = self::domains();

        if (is_int($key)) {
            return $domains[$key] ?? null;
        }

        foreach ($domains as $domain) {
            if ($domain['key'] === $key || $domain['route_prefix'] === $key) {
                return $domain;
            }
        }

        return null;
    }
}
