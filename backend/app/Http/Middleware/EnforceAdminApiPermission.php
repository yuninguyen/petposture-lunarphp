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

        if ($this->isCommentPath($relativePath)) {
            return $this->commentAbilityFor($request, $relativePath);
        }

        if ($this->isBlogTagPath($relativePath)) {
            return $this->blogTagAbilityFor($request, $relativePath);
        }

        if ($this->isPostPath($relativePath)) {
            return $this->postAbilityFor($request, $relativePath);
        }

        if ($this->isBlogCategoryPath($relativePath)) {
            return $this->blogCategoryAbilityFor($request, $relativePath);
        }

        if ($this->isPagePath($relativePath)) {
            return $this->pageAbilityFor($request, $relativePath);
        }

        if ($this->isMediaPath($relativePath)) {
            return $this->mediaAbilityFor($request, $relativePath);
        }

        if ($this->isSeoSocialPath($relativePath)) {
            return $this->seoSocialAbilityFor($request, $relativePath);
        }

        if ($this->isAffiliateNetworkSelectorPath($relativePath)) {
            return $this->affiliateNetworkSelectorAbilityFor($request, $relativePath);
        }

        if ($this->isUsersPath($relativePath)) {
            return $this->usersAbilityFor($request, $relativePath);
        }

        if ($this->isGoalsPath($relativePath)) {
            return $this->goalsAbilityFor($request, $relativePath);
        }

        if ($this->isSystemMediaPath($relativePath)) {
            return $this->systemMediaAbilityFor($request, $relativePath);
        }

        if ($this->isSystemActivityLogPath($relativePath)) {
            return $this->systemActivityLogAbilityFor($request, $relativePath);
        }

        if ($this->isAffiliateReportPath($relativePath)) {
            return $this->affiliateReportAbilityFor($request, $relativePath);
        }

        if ($this->isSystemRolePath($relativePath)) {
            return $this->systemRoleAbilityFor($request, $relativePath);
        }

        if ($this->isSystemUserPath($relativePath)) {
            return $this->systemUserAbilityFor($request, $relativePath);
        }

        if ($this->isAffiliateNetworkPath($relativePath)) {
            return $this->affiliateNetworkAbilityFor($request, $relativePath);
        }

        if ($this->isDashboardSalesPath($relativePath)) {
            return $this->dashboardSalesAbilityFor($request, $relativePath);
        }

        if ($this->isDashboardConversionPath($relativePath)) {
            return $this->dashboardConversionAbilityFor($request, $relativePath);
        }

        if ($this->isReviewPath($relativePath)) {
            return $this->reviewAbilityFor($request, $relativePath);
        }

        if ($this->isReturnRequestPath($relativePath)) {
            return $this->returnRequestAbilityFor($request, $relativePath);
        }

        if ($this->isOrderPath($relativePath)) {
            return $this->orderAbilityFor($request, $relativePath);
        }

        if ($this->isProductPath($relativePath)) {
            return $this->productAbilityFor($request, $relativePath);
        }

        return null;
    }

    private function productAbilityFor(Request $request, string $relativePath): ?string
    {
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

    private function orderAbilityFor(Request $request, string $relativePath): ?string
    {
        if ($request->isMethod('get')) {
            if ($request->isMethod('get') && in_array($relativePath, [
                'orders/product-picker',
                'orders/product-picker/{product}/variants',
            ], true)) {
                return 'update_order';
            }

            return 'view_any_order';
        }

        if ($request->isMethod('post') && $relativePath === 'orders') {
            return 'create_order';
        }

        if ($request->isMethod('post') && str_ends_with($relativePath, '/refund')) {
            return 'refund_order';
        }

        if ($request->isMethod('post') && str_ends_with($relativePath, '/return')) {
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

    private function isCommentPath(string $path): bool
    {
        return $path === 'comments' || str_starts_with($path, 'comments/');
    }

    private function commentAbilityFor(Request $request, string $relativePath): ?string
    {
        if (str_ends_with($relativePath, '/approve')) {
            return $request->isMethod('post') ? 'approve_comment' : null;
        }

        if ($request->isMethod('get')) {
            return $relativePath === 'comments' ? 'view_any_comment' : 'view_comment';
        }

        if ($request->isMethod('post')) {
            if ($relativePath === 'comments/bulk-delete' || str_contains($relativePath, 'bulk-delete')) {
                return 'delete_any_comment';
            }

            return $relativePath === 'comments' ? 'create_comment' : null;
        }

        if ($request->isMethod('put') || $request->isMethod('patch')) {
            return 'update_comment';
        }

        if ($request->isMethod('delete')) {
            return str_contains($relativePath, 'bulk-delete') ? 'delete_any_comment' : 'delete_comment';
        }

        return null;
    }

    private function isBlogTagPath(string $path): bool
    {
        return $path === 'blog/tags' || str_starts_with($path, 'blog/tags/');
    }

    private function isPostPath(string $path): bool
    {
        return $path === 'posts' || str_starts_with($path, 'posts/');
    }

    private function postAbilityFor(Request $request, string $relativePath): ?string
    {
        if ($request->isMethod('post')) {
            if ($relativePath === 'posts/bulk-delete') {
                return 'delete_any_post';
            }

            if ($relativePath === 'posts/generate-seo') {
                return 'generate_post_seo';
            }

            if (str_ends_with($relativePath, '/duplicate')) {
                return 'duplicate_post';
            }

            return $relativePath === 'posts' ? 'create_post' : null;
        }

        if ($request->isMethod('get')) {
            return $relativePath === 'posts' ? 'view_any_post' : 'view_post';
        }

        if ($request->isMethod('put') || $request->isMethod('patch')) {
            return 'update_post';
        }

        if ($request->isMethod('delete')) {
            return 'delete_post';
        }

        return null;
    }

    private function isBlogCategoryPath(string $path): bool
    {
        return $path === 'blog/categories' || str_starts_with($path, 'blog/categories/');
    }

    private function blogCategoryAbilityFor(Request $request, string $relativePath): ?string
    {
        if ($request->isMethod('get')) {
            return $relativePath === 'blog/categories' ? 'view_any_blog_category' : 'view_blog_category';
        }

        if ($request->isMethod('post')) {
            if ($relativePath === 'blog/categories/bulk-delete') {
                return 'delete_any_blog_category';
            }

            return $relativePath === 'blog/categories' ? 'create_blog_category' : null;
        }

        if ($request->isMethod('put') || $request->isMethod('patch')) {
            return 'update_blog_category';
        }

        if ($request->isMethod('delete')) {
            return 'delete_blog_category';
        }

        return null;
    }

    private function blogTagAbilityFor(Request $request, string $relativePath): ?string
    {
        if ($request->isMethod('get')) {
            return $relativePath === 'blog/tags' ? 'view_any_blog_tag' : 'view_blog_tag';
        }

        if ($request->isMethod('post')) {
            if ($relativePath === 'blog/tags/bulk-delete' || str_contains($relativePath, 'bulk-delete')) {
                return 'delete_any_blog_tag';
            }

            return $relativePath === 'blog/tags' ? 'create_blog_tag' : null;
        }

        if ($request->isMethod('put') || $request->isMethod('patch')) {
            return 'update_blog_tag';
        }

        if ($request->isMethod('delete')) {
            return str_contains($relativePath, 'bulk-delete') ? 'delete_any_blog_tag' : 'delete_blog_tag';
        }

        return null;
    }

    private function isPagePath(string $path): bool
    {
        return $path === 'pages' || str_starts_with($path, 'pages/');
    }

    private function pageAbilityFor(Request $request, string $relativePath): ?string
    {
        if ($request->isMethod('get')) {
            return $relativePath === 'pages' ? 'view_any_page' : 'view_page';
        }

        if ($request->isMethod('post')) {
            if ($relativePath === 'pages/bulk-delete' || str_contains($relativePath, 'bulk-delete')) {
                return 'delete_any_page';
            }

            return $relativePath === 'pages' ? 'create_page' : null;
        }

        if ($request->isMethod('put') || $request->isMethod('patch')) {
            return 'update_page';
        }

        if ($request->isMethod('delete')) {
            return str_contains($relativePath, 'bulk-delete') ? 'delete_any_page' : 'delete_page';
        }

        return null;
    }

    private function isMediaPath(string $path): bool
    {
        return $path === 'media' || str_starts_with($path, 'media/');
    }

    private function mediaAbilityFor(Request $request, string $relativePath): ?string
    {
        if ($request->isMethod('get')) {
            return $relativePath === 'media' ? 'view_any_media' : 'view_media';
        }

        if ($request->isMethod('post') && $relativePath === 'media') {
            return 'create_media';
        }

        if ($request->isMethod('put') || $request->isMethod('patch')) {
            return 'update_media';
        }

        if ($request->isMethod('delete')) {
            return str_contains($relativePath, 'bulk-delete') ? 'delete_any_media' : 'delete_media';
        }

        return null;
    }

    private function isSeoSocialPath(string $path): bool
    {
        return $path === 'seo-social' || str_starts_with($path, 'seo-social/');
    }

    private function seoSocialAbilityFor(Request $request, string $relativePath): ?string
    {
        if ($request->isMethod('get')) {
            return 'view_seo_social';
        }

        if ($request->isMethod('post') || $request->isMethod('put') || $request->isMethod('patch')) {
            return 'update_seo_social';
        }

        return null;
    }

    private function isAffiliateNetworkSelectorPath(string $path): bool
    {
        return $path === 'affiliate-networks' || str_starts_with($path, 'affiliate-networks/');
    }

    private function affiliateNetworkSelectorAbilityFor(Request $request, string $relativePath): ?string
    {
        if ($request->isMethod('get')) {
            return 'view_affiliate_network_selector';
        }

        return null;
    }

    private function isUsersPath(string $path): bool
    {
        return $path === 'users' || str_starts_with($path, 'users/');
    }

    private function usersAbilityFor(Request $request, string $relativePath): ?string
    {
        if ($request->isMethod('get')) {
            return $relativePath === 'users' ? 'view_any_user' : 'view_user';
        }

        return null;
    }

    private function isGoalsPath(string $path): bool
    {
        return $path === 'goals' || str_starts_with($path, 'goals/');
    }

    private function goalsAbilityFor(Request $request, string $relativePath): ?string
    {
        if ($request->isMethod('get')) {
            return 'view_any_goal';
        }

        if ($request->isMethod('put') || $request->isMethod('patch')) {
            return 'update_goal';
        }

        return null;
    }

    private function isSystemMediaPath(string $path): bool
    {
        return $path === 'system/media' || str_starts_with($path, 'system/media/');
    }

    private function systemMediaAbilityFor(Request $request, string $relativePath): ?string
    {
        if ($request->isMethod('get')) {
            return 'view_any_system_media';
        }

        if ($request->isMethod('delete')) {
            return 'delete_system_media';
        }

        return null;
    }

    private function isSystemActivityLogPath(string $path): bool
    {
        return $path === 'system/activity-logs' || str_starts_with($path, 'system/activity-logs/');
    }

    private function systemActivityLogAbilityFor(Request $request, string $relativePath): ?string
    {
        if ($request->isMethod('get')) {
            return $relativePath === 'system/activity-logs' ? 'view_any_activity_log' : 'view_activity_log';
        }

        return null;
    }

    private function isAffiliateReportPath(string $path): bool
    {
        return $path === 'affiliate/reports' || str_starts_with($path, 'affiliate/reports/');
    }

    private function affiliateReportAbilityFor(Request $request, string $relativePath): ?string
    {
        if ($request->isMethod('get')) {
            return $relativePath === 'affiliate/reports' ? 'view_any_affiliate_report' : 'view_affiliate_report';
        }

        return null;
    }

    private function isSystemRolePath(string $path): bool
    {
        return $path === 'system/roles' || str_starts_with($path, 'system/roles/');
    }

    private function systemRoleAbilityFor(Request $request, string $relativePath): ?string
    {
        if ($request->isMethod('get')) {
            return $relativePath === 'system/roles' ? 'view_any_role' : 'view_role';
        }

        if ($request->isMethod('post') && $relativePath === 'system/roles') {
            return 'create_role';
        }

        if ($request->isMethod('put') || $request->isMethod('patch')) {
            return 'update_role';
        }

        if ($request->isMethod('delete')) {
            return str_contains($relativePath, 'bulk-delete') ? 'delete_any_role' : 'delete_role';
        }

        return null;
    }

    private function isSystemUserPath(string $path): bool
    {
        return $path === 'system/users' || str_starts_with($path, 'system/users/');
    }

    private function systemUserAbilityFor(Request $request, string $relativePath): ?string
    {
        if ($request->isMethod('get')) {
            return $relativePath === 'system/users' ? 'view_any_system_user' : 'view_system_user';
        }

        if ($request->isMethod('post') && $relativePath === 'system/users') {
            return 'create_system_user';
        }

        if ($request->isMethod('put') || $request->isMethod('patch')) {
            return 'update_system_user';
        }

        if ($request->isMethod('delete')) {
            return 'delete_system_user';
        }

        return null;
    }

    private function isAffiliateNetworkPath(string $path): bool
    {
        return $path === 'affiliate/networks' || str_starts_with($path, 'affiliate/networks/');
    }

    private function affiliateNetworkAbilityFor(Request $request, string $relativePath): ?string
    {
        if (str_ends_with($relativePath, '/sync')) {
            return $request->isMethod('post') ? 'sync_affiliate_network' : null;
        }

        if ($request->isMethod('get')) {
            return $relativePath === 'affiliate/networks' ? 'view_any_affiliate_network' : 'view_affiliate_network';
        }

        if ($request->isMethod('post') && $relativePath === 'affiliate/networks') {
            return 'create_affiliate_network';
        }

        if ($request->isMethod('put') || $request->isMethod('patch')) {
            return 'update_affiliate_network';
        }

        if ($request->isMethod('delete')) {
            return 'delete_affiliate_network';
        }

        return null;
    }

    private function isDashboardSalesPath(string $path): bool
    {
        return $path === 'dashboard/sales' || str_starts_with($path, 'dashboard/sales/');
    }

    private function dashboardSalesAbilityFor(Request $request, string $relativePath): ?string
    {
        if ($request->isMethod('get')) {
            return 'view_dashboard_sales';
        }

        return null;
    }

    private function isDashboardConversionPath(string $path): bool
    {
        return $path === 'dashboard/conversion' || str_starts_with($path, 'dashboard/conversion/');
    }

    private function dashboardConversionAbilityFor(Request $request, string $relativePath): ?string
    {
        if ($request->isMethod('get')) {
            return 'view_dashboard_conversion';
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

    private function reviewAbilityFor(Request $request, string $relativePath): ?string
    {
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

    private function isReturnRequestPath(string $path): bool
    {
        return $path === 'return-requests' || str_starts_with($path, 'return-requests/');
    }

    private function returnRequestAbilityFor(Request $request, string $relativePath): ?string
    {
        if ($request->isMethod('get')) {
            return $relativePath === 'return-requests' ? 'view_any_return_request' : 'view_return_request';
        }

        if ($request->isMethod('post')) {
            if (str_ends_with($relativePath, '/approve')) {
                return 'approve_return_request';
            }

            if (str_ends_with($relativePath, '/reject')) {
                return 'reject_return_request';
            }

            if (str_ends_with($relativePath, '/complete')) {
                return 'complete_return_request';
            }

            if (str_ends_with($relativePath, '/tracking')) {
                return 'update_return_request';
            }

            if (str_ends_with($relativePath, '/approve-low-value-waiver')) {
                return 'approve_return_request';
            }

            if (str_ends_with($relativePath, '/preview')) {
                return 'view_return_request';
            }
        }

        return null;
    }

    private function isOrderPath(string $path): bool
    {
        return $path === 'orders' || str_starts_with($path, 'orders/');
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
