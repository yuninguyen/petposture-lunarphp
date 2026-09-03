import { useEffect, useState, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { AppShell } from '@/layouts/AppShell';
import { LoginPage } from '@/features/auth/LoginPage';
import { AdminUser, fetchCurrentUser, isAdminRole } from '@/lib/auth';
import { Toaster } from 'react-hot-toast';

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

function PageLoader() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
    </div>
  );
}


export default function App() {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [authFailed, setAuthFailed] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    fetchCurrentUser()
      .then((u) => {
        if (isAdminRole(u.roles)) {
          setUser(u);
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
        <AppShell userName={user?.name ?? ''} userRoles={user?.roles ?? []}>
          <Suspense fallback={<PageLoader />}>
            <AppRoutes userRoles={user?.roles ?? []} />
          </Suspense>
        </AppShell>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

function isCoreAdministrator(userRoles: string[]) {
  return userRoles.some((role) => ['super_admin', 'admin', 'staff'].includes(role));
}

export function canManageCommerce(userRoles: string[]) {
  return isCoreAdministrator(userRoles) || userRoles.includes('Order Manager') || userRoles.includes('Support');
}

export function canManageDiscounts(userRoles: string[]) {
  return isCoreAdministrator(userRoles);
}

export function canManageShipping(userRoles: string[]) {
  return isCoreAdministrator(userRoles);
}

export function canManageCustomers(userRoles: string[]) {
  return isCoreAdministrator(userRoles);
}

export function canManageReviews(userRoles: string[]) {
  return isCoreAdministrator(userRoles) || userRoles.includes('Support') || userRoles.includes('Product Manager');
}

export function canDeleteReviews(userRoles: string[]) {
  return isCoreAdministrator(userRoles);
}

export function canRefundOrders(userRoles: string[]) {
  return isCoreAdministrator(userRoles) || userRoles.includes('Order Manager');
}

export function getAdminHomeRoute(userRoles: string[]) {
  const isCoreAdmin = isCoreAdministrator(userRoles);
  const canManageProducts = isCoreAdmin || userRoles.includes('Product Manager');
  if (canManageCommerce(userRoles) && !isCoreAdmin && !canManageProducts) return '/orders';
  return canManageProducts && !isCoreAdmin ? '/products' : '/posts';
}

export function AppRoutes({ userRoles }: { userRoles: string[] }) {
  const location = useLocation();
  const isCoreAdmin = isCoreAdministrator(userRoles);
  const canManageProducts = isCoreAdmin || userRoles.includes('Product Manager');
  const canManageSales = canManageCommerce(userRoles);
  const canManageDiscountsList = canManageDiscounts(userRoles);
  const canManageShippingMethods = canManageShipping(userRoles);
  const canViewCustomers = canManageCustomers(userRoles);
  const canModerateReviews = canManageReviews(userRoles);
  const home = getAdminHomeRoute(userRoles);

  if (!isCoreAdmin && !canManageProducts && !canManageSales) {
    return <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">Use the Filament admin panel for order and support workflows.</div>;
  }

  return (
    <Routes>
      <Route path="/" element={<Navigate to={home} replace />} />
      {isCoreAdmin && <>
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
      {canManageSales && <>
        <Route path="/orders" element={<OrdersListPage />} />
        <Route path="/orders/new" element={<OrderFormPage />} />
        <Route path="/orders/:id" element={<OrderDetailPage canRefund={canRefundOrders(userRoles)} />} />
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
