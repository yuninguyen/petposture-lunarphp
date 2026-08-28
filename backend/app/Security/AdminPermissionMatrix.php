<?php

namespace App\Security;

use App\Models\User;

final class AdminPermissionMatrix
{
    public const PRODUCT = [
        'view_any_product',
        'view_product',
        'create_product',
        'update_product',
        'delete_product',
        'delete_any_product',
        'publish_product',
    ];

    public const ORDER = [
        'view_any_order',
        'view_order',
        'update_order',
        'refund_order',
    ];

    public const REVIEW = [
        'view_any_review',
        'view_review',
        'update_review',
        'delete_review',
        'delete_any_review',
    ];

    public const POST = [
        'view_any_post',
        'view_post',
        'create_post',
        'update_post',
        'delete_post',
        'delete_any_post',
        'publish_post',
    ];

    public static function allPermissions(): array
    {
        return array_values(array_unique(array_merge(
            self::PRODUCT,
            self::ORDER,
            self::REVIEW,
            self::POST,
        )));
    }

    public static function permissionsForRole(string $role): array
    {
        return match ($role) {
            'super_admin', 'admin', 'staff' => self::allPermissions(),
            'Product Manager' => [
                ...self::PRODUCT,
                'view_any_review',
                'view_review',
                'update_review',
            ],
            'Order Manager' => self::ORDER,
            'Support' => [
                'view_any_order',
                'view_order',
                'update_order',
                'view_any_review',
                'view_review',
                'update_review',
            ],
            default => [],
        };
    }

    public static function adminRoles(): array
    {
        return User::ADMIN_PANEL_ROLES;
    }
}
