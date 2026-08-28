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

        $ability = $this->abilityFor($request);

        abort_unless($ability, 403);
        Gate::authorize($ability);

        return $next($request);
    }

    private function abilityFor(Request $request): ?string
    {
        $path = ltrim((string) $request->route()?->uri(), '/');
        $relativePath = preg_replace('#^api(?:/v1)?/admin/#', '', $path) ?? $path;

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

        if ($request->user()?->hasAnyRole(['Order Manager', 'Support']) && $this->isOrderPath($relativePath)) {
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

    private function isProductPath(string $path): bool
    {
        foreach (['brands', 'breeds', 'collection-groups', 'collections', 'products', 'product-types', 'custom-fields', 'solutions'] as $prefix) {
            if ($path === $prefix || str_starts_with($path, $prefix.'/')) {
                return true;
            }
        }

        return false;
    }

    private function isOrderPath(string $path): bool
    {
        return $path === 'return-requests'
            || str_starts_with($path, 'return-requests/')
            || str_starts_with($path, 'orders/');
    }
}
