<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Symfony\Component\HttpFoundation\Response;

class EnforceAdminApiPermission
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if ($user?->hasAnyRole(['super_admin', 'admin', 'staff'])) {
            return $next($request);
        }

        $path = ltrim((string) $request->route()?->uri(), '/');
        $relativePath = preg_replace('#^api(?:/v1)?/admin/#', '', $path) ?? $path;

        if ($this->isProfilePath($relativePath) || $this->isNotificationPath($relativePath)) {
            return $next($request);
        }

        $ability = $this->abilityFor($request);

        abort_unless($ability, 403);
        Gate::authorize($ability);

        return $next($request);
    }

    private function abilityFor(Request $request): ?string
    {
        $path = ltrim((string) $request->route()?->uri(), '/');
        $relativePath = preg_replace('#^api(?:/v1)?/admin/#', '', $path) ?? $path;

        if ($this->isBrandPath($relativePath)) {
            return $this->brandAbilityFor($request, $relativePath);
        }

        if ($this->isBreedPath($relativePath)) {
            return $this->breedAbilityFor($request, $relativePath);
        }

        if ($this->isCollectionGroupPath($relativePath)) {
            return $this->collectionGroupAbilityFor($request, $relativePath);
        }

        if ($this->isCollectionPath($relativePath)) {
            return $this->collectionAbilityFor($request, $relativePath);
        }

        if ($this->isProductTypePath($relativePath)) {
            return $this->productTypeAbilityFor($request, $relativePath);
        }

        if ($this->isCustomFieldPath($relativePath)) {
            return $this->customFieldAbilityFor($request, $relativePath);
        }

        if ($this->isSolutionPath($relativePath)) {
            return $this->solutionAbilityFor($request, $relativePath);
        }

        if ($request->user()?->hasRole('Product Manager') && $this->isProductPath($relativePath)) {
            if ($request->isMethod('get')) {
                return 'view_any_product';
            }

            if (str_contains($relativePath, 'bulk-status')) {
                return 'publish_product';
            }

            if ($request->isMethod('delete') || str_contains($relativePath, 'bulk-delete')) {
                return 'delete_product';
            }

            if ($request->isMethod('post') && $relativePath === 'products') {
                return 'create_product';
            }

            return 'update_product';
        }

        if ($request->user()?->hasAnyRole(['Product Manager', 'Support']) && $this->isReviewPath($relativePath)) {
            if ($request->isMethod('get')) {
                return 'view_any_review';
            }

            if ($request->isMethod('put') || $request->isMethod('patch')) {
                return 'update_review';
            }

            if ($request->isMethod('delete')) {
                return 'delete_review';
            }

            return null;
        }

        if ($request->user()?->hasAnyRole(['Order Manager', 'Support']) && ($this->isOrderPath($relativePath) || $relativePath === 'dashboard/sales' || $relativePath === 'dashboard/conversion')) {
            if ($relativePath === 'dashboard/sales' || $relativePath === 'dashboard/conversion') {
                return 'view_any_order';
            }
            if ($request->isMethod('get') && in_array($relativePath, [
                'orders/product-picker',
                'orders/product-picker/{product}/variants',
            ], true)) {
                return 'update_order';
            }

            if ($request->isMethod('get')) {
                return 'view_any_order';
            }

            if (str_ends_with($relativePath, '/refund')) {
                return 'refund_order';
            }

            return 'update_order';
        }

        return null;
    }

    private function isBrandPath(string $path): bool
    {
        return $path === 'brands' || str_starts_with($path, 'brands/');
    }

    private function brandAbilityFor(Request $request, string $relativePath): ?string
    {
        if ($request->isMethod('get')) {
            return $relativePath === 'brands' ? 'view_any_brand' : 'view_brand';
        }

        if ($request->isMethod('post') && $relativePath === 'brands') {
            return 'create_brand';
        }

        if ($request->isMethod('put') || $request->isMethod('patch')) {
            return 'update_brand';
        }

        if ($request->isMethod('delete')) {
            return str_contains($relativePath, 'bulk-delete') ? 'delete_any_brand' : 'delete_brand';
        }

        return null;
    }

    private function isBreedPath(string $path): bool
    {
        return $path === 'breeds' || str_starts_with($path, 'breeds/');
    }

    private function breedAbilityFor(Request $request, string $relativePath): ?string
    {
        if ($request->isMethod('get')) {
            return $relativePath === 'breeds' ? 'view_any_breed' : 'view_breed';
        }

        if ($request->isMethod('post')) {
            if ($relativePath === 'breeds/bulk-delete' || str_contains($relativePath, 'bulk-delete')) {
                return 'delete_any_breed';
            }

            return $relativePath === 'breeds' ? 'create_breed' : null;
        }

        if ($request->isMethod('put') || $request->isMethod('patch')) {
            return 'update_breed';
        }

        if ($request->isMethod('delete')) {
            return str_contains($relativePath, 'bulk-delete') ? 'delete_any_breed' : 'delete_breed';
        }

        return null;
    }

    private function isCollectionGroupPath(string $path): bool
    {
        return $path === 'collection-groups' || str_starts_with($path, 'collection-groups/');
    }

    private function collectionGroupAbilityFor(Request $request, string $relativePath): ?string
    {
        if ($request->isMethod('get')) {
            return $relativePath === 'collection-groups' ? 'view_any_collection_group' : 'view_collection_group';
        }

        if ($request->isMethod('post') && $relativePath === 'collection-groups') {
            return 'create_collection_group';
        }

        if ($request->isMethod('put') || $request->isMethod('patch')) {
            return 'update_collection_group';
        }

        if ($request->isMethod('delete')) {
            return str_contains($relativePath, 'bulk-delete') ? 'delete_any_collection_group' : 'delete_collection_group';
        }

        return null;
    }

    private function isCollectionPath(string $path): bool
    {
        return $path === 'collections' || str_starts_with($path, 'collections/');
    }

    private function collectionAbilityFor(Request $request, string $relativePath): ?string
    {
        if (str_ends_with($relativePath, '/reorder')) {
            return $request->isMethod('post') ? 'reorder_collection' : null;
        }

        if (str_ends_with($relativePath, '/move')) {
            return $request->isMethod('post') ? 'move_collection' : null;
        }

        if (str_ends_with($relativePath, '/products')) {
            if ($request->isMethod('get')) {
                return 'view_collection';
            }
            if ($request->isMethod('put')) {
                return 'update_collection';
            }
            return null;
        }

        if ($request->isMethod('get')) {
            return $relativePath === 'collections' ? 'view_any_collection' : 'view_collection';
        }

        if ($request->isMethod('post') && $relativePath === 'collections') {
            return 'create_collection';
        }

        if ($request->isMethod('put') || $request->isMethod('patch')) {
            return 'update_collection';
        }

        if ($request->isMethod('delete')) {
            return str_contains($relativePath, 'bulk-delete') ? 'delete_any_collection' : 'delete_collection';
        }

        return null;
    }

    private function isProductTypePath(string $path): bool
    {
        return $path === 'product-types' || str_starts_with($path, 'product-types/');
    }

    private function productTypeAbilityFor(Request $request, string $relativePath): ?string
    {
        if ($request->isMethod('get')) {
            return $relativePath === 'product-types' ? 'view_any_product_type' : 'view_product_type';
        }

        if ($request->isMethod('post') && $relativePath === 'product-types') {
            return 'create_product_type';
        }

        if ($request->isMethod('put') || $request->isMethod('patch')) {
            return 'update_product_type';
        }

        if ($request->isMethod('delete')) {
            return 'delete_product_type';
        }

        return null;
    }

    private function isCustomFieldPath(string $path): bool
    {
        return $path === 'custom-fields' || str_starts_with($path, 'custom-fields/');
    }

    private function customFieldAbilityFor(Request $request, string $relativePath): ?string
    {
        if ($request->isMethod('get')) {
            return $relativePath === 'custom-fields' ? 'view_any_custom_field' : 'view_custom_field';
        }

        if ($request->isMethod('post') && $relativePath === 'custom-fields') {
            return 'create_custom_field';
        }

        if ($request->isMethod('put') || $request->isMethod('patch')) {
            return 'update_custom_field';
        }

        if ($request->isMethod('delete')) {
            return 'delete_custom_field';
        }

        return null;
    }

    private function isSolutionPath(string $path): bool
    {
        return $path === 'solutions' || str_starts_with($path, 'solutions/');
    }

    private function solutionAbilityFor(Request $request, string $relativePath): ?string
    {
        if ($request->isMethod('get')) {
            return $relativePath === 'solutions' ? 'view_any_solution' : 'view_solution';
        }

        if ($request->isMethod('post')) {
            if ($relativePath === 'solutions/bulk-delete' || str_contains($relativePath, 'bulk-delete')) {
                return 'delete_any_solution';
            }

            return $relativePath === 'solutions' ? 'create_solution' : null;
        }

        if ($request->isMethod('put') || $request->isMethod('patch')) {
            return 'update_solution';
        }

        if ($request->isMethod('delete')) {
            return str_contains($relativePath, 'bulk-delete') ? 'delete_any_solution' : 'delete_solution';
        }

        return null;
    }

    private function isProductPath(string $path): bool
    {
        return $path === 'products' || str_starts_with($path, 'products/');
    }

    private function isReviewPath(string $path): bool
    {
        return $path === 'reviews' || str_starts_with($path, 'reviews/');
    }

    private function isOrderPath(string $path): bool
    {
        return $path === 'return-requests'
            || str_starts_with($path, 'return-requests/')
            || $path === 'orders'
            || str_starts_with($path, 'orders/');
    }

    private function isProfilePath(string $path): bool
    {
        return $path === 'profile' || $path === 'profile/password';
    }

    private function isNotificationPath(string $path): bool
    {
        return $path === 'notifications' || str_starts_with($path, 'notifications/');
    }
}
