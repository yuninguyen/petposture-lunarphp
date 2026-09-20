import { useEffect, useState, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { AppShell } from '@/layouts/AppShell';
import { LoginPage } from '@/features/auth/LoginPage';
import { AdminUser, fetchCurrentUser, isAdminRole } from '@/lib/auth';
import { fetchAbilities, can } from '@/lib/permissions';
import toast, { Toaster } from 'react-hot-toast';
import { BrandingProvider } from '@/context/BrandingContext';
import { canAccessFinance } from '@/navigation/adminNavigation';

// Lazy-load all page components → Vite creates separate chunks per route
const PostsListPage   = lazy(() => import('@/features/posts/PostsListPage').then(m => ({ default: m.PostsListPage })));
const PostFormPage    = lazy(() => import('@/features/posts/PostFormPage').then(m => ({ default: m.PostFormPage })));
const BlogCategoriesList = lazy(() => import('@/features/blog-categories/BlogCategoriesList').then(m => ({ default: m.BlogCategoriesList })));
const CommentsList    = lazy(() => import('@/features/comments/CommentsList').then(m => ({ default: m.CommentsList })));
const TagsList        = lazy(() => import('@/features/tags/TagsList').then(m => ({ default: m.TagsList })));
const SeoSocialPage   = lazy(() => import('@/features/settings/seo-social/SeoSocialPage').then(m => ({ default: m.SeoSocialPage })));
const PagesListPage   = lazy(() => import('@/features/pages/PagesListPage').then(m => ({ default: m.PagesListPage })));
const PageFormPage    = lazy(() => import('@/features/pages/PageFormPage').then(m => ({ default: m.PageFormPage })));
const BreedsListPage  = lazy(() => import('@/features/breeds/BreedsListPage').then(m => ({ default: m.BreedsListPage })));
const BreedFormPage   = lazy(() => import('@/features/breeds/BreedFormPage').then(m => ({ default: m.BreedFormPage })));
const SolutionsListPage = lazy(() => import('@/features/solutions/SolutionsListPage').then(m => ({ default: m.SolutionsListPage })));
const SolutionFormPage = lazy(() => import('@/features/solutions/SolutionFormPage').then(m => ({ default: m.SolutionFormPage })));
const ProductTypesPage = lazy(() => import('@/features/product-types/ProductTypesPage').then(m => ({ default: m.ProductTypesPage })));
const CustomFieldsPage = lazy(() => import('@/features/custom-fields/CustomFieldsPage').then(m => ({ default: m.CustomFieldsPage })));
const BrandsPage = lazy(() => import('@/features/brands/BrandsPage').then(m => ({ default: m.BrandsPage })));
const CollectionGroupsPage = lazy(() => import('@/features/collection-groups/CollectionGroupsPage').then(m => ({ default: m.CollectionGroupsPage })));
const CollectionsPage = lazy(() => import('@/features/collections/CollectionsPage').then(m => ({ default: m.CollectionsPage })));
const ProductsListPage = lazy(() => import('@/features/products/ProductsListPage').then(m => ({ default: m.ProductsListPage })));
const ProductFormPage = lazy(() => import('@/features/products/ProductFormPage').then(m => ({ default: m.ProductFormPage })));
const OrdersListPage = lazy(() => import('@/features/orders/OrdersListPage').then(m => ({ default: m.OrdersListPage })));
const OrderFormPage = lazy(() => import('@/features/orders/OrderFormPage').then(m => ({ default: m.OrderFormPage })));
const OrderDetailPage = lazy(() => import('@/features/orders/OrderDetailPage').then(m => ({ default: m.OrderDetailPage })));
const ReturnRequestsListPage = lazy(() => import('@/features/return-requests/ReturnRequestsListPage').then(m => ({ default: m.ReturnRequestsListPage })));
const ReturnRequestDetailPage = lazy(() => import('@/features/return-requests/ReturnRequestDetailPage').then(m => ({ default: m.ReturnRequestDetailPage })));
const ShippingMethodsPage = lazy(() => import('@/features/shipping/ShippingMethodsPage').then(m => ({ default: m.ShippingMethodsPage })));
const ReviewsPage = lazy(() => import('@/features/reviews/ReviewsPage').then(m => ({ default: m.ReviewsPage })));
const CustomersListPage = lazy(() => import('@/features/customers/CustomersListPage').then(m => ({ default: m.CustomersListPage })));
const CustomerDetailPage = lazy(() => import('@/features/customers/CustomerDetailPage').then(m => ({ default: m.CustomerDetailPage })));
const DiscountsListPage = lazy(() => import('@/features/discounts/DiscountsListPage').then(m => ({ default: m.DiscountsListPage })));
const DiscountFormPage = lazy(() => import('@/features/discounts/DiscountFormPage').then(m => ({ default: m.DiscountFormPage })));
const SalesPage = lazy(() => import('@/features/dashboard/SalesPage').then(m => ({ default: m.SalesPage })));
const ConversionPage = lazy(() => import('@/features/dashboard/ConversionPage').then(m => ({ default: m.ConversionPage })));
const GoalsPage = lazy(() => import('@/features/finance/GoalsPage').then(m => ({ default: m.GoalsPage })));
const PaymentMethodsPage = lazy(() =>
  import('@/features/payment-methods/PaymentMethodsPage').then((m) => ({ default: m.PaymentMethodsPage }))
);
const ProfilePage = lazy(() => import('@/features/profile/ProfilePage').then(m => ({ default: m.ProfilePage })));
const SystemUsersPage = lazy(() => import('@/features/system-users/SystemUsersPage').then(m => ({ default: m.SystemUsersPage })));
const MediaLibraryPage = lazy(() => import('@/features/system-media/MediaLibraryPage').then(m => ({ default: m.MediaLibraryPage })));
const RolesPage = lazy(() => import('@/features/system-roles/RolesPage').then(m => ({ default: m.RolesPage })));
const ActivityLogsPage = lazy(() => import('@/features/system-activity-logs/ActivityLogsPage').then(m => ({ default: m.ActivityLogsPage })));
const SettingsPage = lazy(() => import('@/features/settings/SettingsPage').then(m => ({ default: m.SettingsPage })));
const AffiliateReportsPage = lazy(() => import('@/features/affiliate-reports/AffiliateReportsPage').then(m => ({ default: m.AffiliateReportsPage })));
const AffiliateNetworksPage = lazy(() => import('@/features/affiliate-networks/AffiliateNetworksPage').then(m => ({ default: m.AffiliateNetworksPage })));

function PageLoader() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
    </div>
  );
}


export function CacheWarningListener() {
  useEffect(() => {
    const handleCacheWarning = (event: Event) => {
      const unavailable = (event as CustomEvent<{ recovery?: unknown }>).detail?.recovery === 'unavailable';
      toast(unavailable
        ? 'Content saved; cache refresh recovery could not be recorded. Automatic retry is not guaranteed; operator action is required.'
        : 'Content was saved, but the storefront cache update is unconfirmed. Public pages may remain stale.', {
        duration: 6000,
      });
    };

    window.addEventListener('petposture:cache-warning', handleCacheWarning);
    return () => window.removeEventListener('petposture:cache-warning', handleCacheWarning);
  }, []);

  return null;
}

export default function App() {
  return (
    <BrandingProvider>
      <CacheWarningListener />
      <AdminApp />
    </BrandingProvider>
  );
}

function AdminApp() {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [abilities, setAbilities] = useState<string[]>([]);
  const [authFailed, setAuthFailed] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    fetchCurrentUser()
      .then(async (u) => {
        if (isAdminRole(u.roles)) {
          setUser(u);
          // fetchAbilities() called here (not via the useAbilities() React Query
          // hook) because this effect runs before QueryClientProvider mounts below.
          setAbilities(await fetchAbilities());
          setLoggedIn(true);
        } else {
          setAuthFailed(true);
        }
      })
      .catch(() => setAuthFailed(true))
      .finally(() => setCheckingAuth(false));
  }, []);

  if (checkingAuth) {
    return <PageLoader />;
  }

  if (!loggedIn || authFailed) {
    return (
      <LoginPage
        onLoggedIn={(loggedInUser) => {
          setUser(loggedInUser);
          setAuthFailed(false);
          setLoggedIn(true);
          fetchAbilities().then(setAbilities).catch(() => setAbilities([]));
        }}
      />
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <Toaster 
        position="top-right" 
        toastOptions={{
          className: 'text-sm font-medium shadow-lg rounded-xl border border-slate-100',
          style: {
            background: '#ffffff',
            color: '#0f172a',
            padding: '12px 16px',
          },
          success: {
            iconTheme: {
              primary: '#10b981',
              secondary: '#ffffff',
            },
          },
          error: {
            iconTheme: {
              primary: '#ef4444',
              secondary: '#ffffff',
            },
          },
        }}
      />
      <BrowserRouter>
        <AppShell userName={user?.name ?? ''} userRoles={user?.roles ?? []} userAbilities={abilities}>
          <Suspense fallback={<PageLoader />}>
            <AppRoutes userRoles={user?.roles ?? []} userAbilities={abilities} />
          </Suspense>
        </AppShell>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

function isCoreAdministrator(userRoles: string[]) {
  return userRoles.some((role) => ['super_admin', 'admin', 'staff'].includes(role));
}

export function canManageCommerce(_userRoles: string[], abilities: string[] = []) {
  return can(abilities, 'view_any_order');
}

export function canManageDiscounts(_userRoles: string[], abilities: string[] = []) {
  return can(abilities, 'view_any_discount');
}

export function canManageShipping(_userRoles: string[], abilities: string[] = []) {
  return can(abilities, 'view_any_shipping_method');
}

export function canManageCustomers(_userRoles: string[], abilities: string[] = []) {
  return can(abilities, 'view_any_customer');
}

export function canManageReviews(_userRoles: string[], abilities: string[] = []) {
  return can(abilities, 'view_any_review');
}

// Kept role-based intentionally: the UI has always restricted review deletion to
// core admins only, even though Support/Product Manager hold delete_review on the
// backend (Phase 6b, commit a7ac753). Do not widen this without explicit sign-off.
export function canDeleteReviews(userRoles: string[]) {
  return isCoreAdministrator(userRoles);
}

export function canRefundOrders(_userRoles: string[], abilities: string[] = []) {
  return can(abilities, 'refund_order');
}

export interface HomeRouteCandidate {
  path: string;
  canAccess: (roles: string[], abilities: string[]) => boolean;
}

// Landing-page PREFERENCE, not an access-control decision (the routes themselves
// are still gated elsewhere by ability). Kept role-based intentionally: Order
// Manager and Support can view the dashboard once inside the app, but their
// default landing page has always been /orders, not /dashboard — only core
// admins land on /dashboard by default. Do not switch this to an ability check.
export const ADMIN_HOME_CANDIDATES: HomeRouteCandidate[] = [
  {
    path: '/dashboard',
    canAccess: (roles) => isCoreAdministrator(roles),
  },
  {
    path: '/products',
    canAccess: (roles, abilities) => !isCoreAdministrator(roles) && can(abilities, 'view_any_product'),
  },
  {
    path: '/orders',
    canAccess: (roles, abilities) => !isCoreAdministrator(roles) && can(abilities, 'view_any_order'),
  },
  {
    path: '/posts',
    canAccess: (roles, abilities) => isCoreAdministrator(roles) && can(abilities, 'view_any_post'),
  },
];

export function getAdminHomeRoute(userRoles: string[], abilities: string[] = [], customCandidates?: HomeRouteCandidate[]) {
  const candidates = customCandidates ?? ADMIN_HOME_CANDIDATES;
  const match = candidates.find((candidate) => candidate.canAccess(userRoles, abilities));
  return match?.path ?? '/dashboard';
}

export function AppRoutes({ userRoles, userAbilities = [] }: { userRoles: string[]; userAbilities?: string[] }) {
  const location = useLocation();
  const isCoreAdmin = isCoreAdministrator(userRoles);
  const canManageProducts = can(userAbilities, 'view_any_product');
  const canManageSales = canManageCommerce(userRoles, userAbilities);
  const canViewDashboard = can(userAbilities, 'view_dashboard_sales') || can(userAbilities, 'view_dashboard_conversion');
  const canManageDiscountsList = canManageDiscounts(userRoles, userAbilities);
  const canManageShippingMethods = canManageShipping(userRoles, userAbilities);
  const canViewFinance = canAccessFinance(userRoles, userAbilities);
  const canViewCustomers = canManageCustomers(userRoles, userAbilities);
  const canModerateReviews = canManageReviews(userRoles, userAbilities);
  const canViewContent = can(userAbilities, 'view_any_blog_category')
    || can(userAbilities, 'view_any_post')
    || can(userAbilities, 'view_any_comment')
    || can(userAbilities, 'view_any_blog_tag')
    || can(userAbilities, 'view_seo_social')
    || can(userAbilities, 'view_any_page');
  const canViewAffiliate = can(userAbilities, 'view_any_affiliate_report') || can(userAbilities, 'view_any_affiliate_network');
  const canViewSystem = can(userAbilities, 'view_any_system_user')
    || can(userAbilities, 'view_any_role')
    || can(userAbilities, 'view_any_system_media')
    || can(userAbilities, 'view_any_activity_log')
    || can(userAbilities, 'view_general_settings');
  const home = getAdminHomeRoute(userRoles, userAbilities);

  if (!isCoreAdmin && !canManageProducts && !canManageSales && location.pathname !== '/system/settings') {
    return <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">Use the Filament admin panel for order and support workflows.</div>;
  }

  return (
    <Routes>
      <Route path="/" element={<Navigate to={home} replace />} />
      {canViewDashboard && <>
        <Route path="/dashboard" element={<Navigate to="/dashboard/sales" replace />} />
        <Route path="/dashboard/sales" element={<SalesPage />} />
        <Route path="/dashboard/conversion" element={<ConversionPage />} />
      </>}
      <Route path="/profile" element={<ProfilePage />} />
      {canViewFinance && <>
        <Route path="/goals" element={<GoalsPage />} />
        <Route path="/finance/payment-methods" element={<PaymentMethodsPage />} />
      </>}
      {canViewContent && <>
        <Route path="/posts" element={<PostsListPage />} />
        <Route path="/posts/new" element={<PostFormPage key={location.pathname} />} />
        <Route path="/posts/:id" element={<PostFormPage key={location.pathname} />} />
        <Route path="/blog-categories" element={<BlogCategoriesList />} />
        <Route path="/comments" element={<CommentsList />} />
        <Route path="/tags" element={<TagsList />} />
        <Route path="/seo-social" element={<SeoSocialPage />} />
        <Route path="/legal-policies" element={<PagesListPage />} />
        <Route path="/legal-policies/create" element={<PageFormPage key={location.pathname} />} />
        <Route path="/legal-policies/:id" element={<PageFormPage key={location.pathname} />} />
      </>}
      {canViewSystem && <>
        <Route path="/system/users" element={<SystemUsersPage />} />
        <Route path="/system/media" element={<MediaLibraryPage />} />
        <Route path="/system/roles" element={<RolesPage />} />
        <Route path="/system/activity-logs" element={<ActivityLogsPage />} />
        <Route path="/system/settings" element={<SettingsPage />} />
      </>}
      {canViewAffiliate && <>
        <Route path="/affiliate/reports" element={<AffiliateReportsPage />} />
        <Route path="/affiliate/networks" element={<AffiliateNetworksPage />} />
      </>}
      {canManageSales && <>
        <Route path="/orders" element={<OrdersListPage />} />
        <Route path="/orders/new" element={<OrderFormPage />} />
        <Route path="/orders/:id" element={<OrderDetailPage canRefund={canRefundOrders(userRoles, userAbilities)} />} />
        <Route path="/return-requests" element={<ReturnRequestsListPage />} />
        <Route path="/return-requests/:id" element={<ReturnRequestDetailPage />} />
      </>}
      {canViewCustomers && <>
        <Route path="/customers" element={<CustomersListPage />} />
        <Route path="/customers/:id" element={<CustomerDetailPage />} />
      </>}
      {canManageDiscountsList && <>
        <Route path="/discounts" element={<DiscountsListPage />} />
        <Route path="/discounts/new" element={<DiscountFormPage />} />
        <Route path="/discounts/:id" element={<DiscountFormPage />} />
      </>}
      {canManageShippingMethods && <Route path="/shipping" element={<ShippingMethodsPage />} />}
      {canModerateReviews && <Route path="/reviews" element={<ReviewsPage canDelete={canDeleteReviews(userRoles)} />} />}
      {canManageProducts && <>
        <Route path="/breeds" element={<BreedsListPage />} />
        <Route path="/breeds/new" element={<BreedFormPage key={location.pathname} />} />
        <Route path="/breeds/:id" element={<BreedFormPage key={location.pathname} />} />
        <Route path="/product-types" element={<ProductTypesPage />} />
        <Route path="/custom-fields" element={<CustomFieldsPage />} />
        <Route path="/brands" element={<BrandsPage />} />
        <Route path="/collection-groups" element={<CollectionGroupsPage />} />
        <Route path="/collections" element={<CollectionsPage />} />
        <Route path="/products" element={<ProductsListPage />} />
        <Route path="/products/:id" element={<ProductFormPage key={location.pathname} />} />
        <Route path="/solutions" element={<SolutionsListPage />} />
        <Route path="/solutions/new" element={<SolutionFormPage key={location.pathname} />} />
        <Route path="/solutions/:id" element={<SolutionFormPage key={location.pathname} />} />
      </>}
      <Route path="*" element={<Navigate to={home} replace />} />
    </Routes>
  );
}
