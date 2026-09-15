import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

vi.mock('./features/orders/OrdersListPage', () => ({ OrdersListPage: () => createElement('div', null, 'Orders route') }));
vi.mock('./features/orders/OrderFormPage', () => ({ OrderFormPage: () => createElement('h1', null, 'orders.create_title') }));
vi.mock('./features/products/ProductsListPage', () => ({ ProductsListPage: () => createElement('div', null, 'Products route') }));
vi.mock('./features/shipping/ShippingMethodsPage', () => ({ ShippingMethodsPage: () => createElement('div', null, 'Shipping route') }));
vi.mock('./features/reviews/ReviewsPage', () => ({ ReviewsPage: ({ canDelete }: { canDelete: boolean }) => createElement('div', null, `Reviews route delete=${canDelete}`) }));
vi.mock('./features/customers/CustomersListPage', () => ({ CustomersListPage: () => createElement('div', null, 'Customers route') }));
vi.mock('./features/customers/CustomerDetailPage', () => ({ CustomerDetailPage: () => createElement('div', null, 'Customer detail route') }));
vi.mock('./features/discounts/DiscountsListPage', () => ({ DiscountsListPage: () => createElement('div', null, 'Discounts route') }));
vi.mock('./features/discounts/DiscountFormPage', () => ({ DiscountFormPage: () => createElement('div', null, 'Discount form route') }));
vi.mock('./features/dashboard/SalesPage', () => ({ SalesPage: () => createElement('div', null, 'Sales dashboard route') }));
vi.mock('./features/dashboard/ConversionPage', () => ({ ConversionPage: () => createElement('div', null, 'Conversion dashboard route') }));
vi.mock('./features/finance/GoalsPage', () => ({ GoalsPage: () => createElement('div', null, 'Goals route') }));
vi.mock('./features/profile/ProfilePage', () => ({ ProfilePage: () => createElement('div', null, 'Profile route') }));
vi.mock('./features/system-users/SystemUsersPage', () => ({ SystemUsersPage: () => createElement('div', null, 'System users route') }));
vi.mock('./features/system-media/MediaLibraryPage', () => ({ MediaLibraryPage: () => createElement('div', null, 'Media library route') }));
vi.mock('./features/system-roles/RolesPage', () => ({ RolesPage: () => createElement('div', null, 'Roles route') }));

import { AppRoutes, canDeleteReviews, canManageCommerce, canManageCustomers, canManageDiscounts, canManageReviews, canManageShipping, canRefundOrders, getAdminHomeRoute, ADMIN_HOME_CANDIDATES, HomeRouteCandidate } from './App';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function renderRoutes(userRoles: string[], path = '/shipping') {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  act(() => root.render(createElement(MemoryRouter, { initialEntries: [path] }, createElement(AppRoutes, { userRoles }))));
  return { host, root };
}

describe('commerce admin role handling', () => {
  it('grants sales visibility to core admin, Order Manager, and Support only', () => {
    expect(canManageCommerce(['admin'])).toBe(true);
    expect(canManageCommerce(['Order Manager'])).toBe(true);
    expect(canManageCommerce(['Support'])).toBe(true);
    expect(canManageCommerce(['Product Manager'])).toBe(false);
  });

  it('uses orders as the Commerce-only home and excludes Support from refunds', () => {
    expect(getAdminHomeRoute(['Support'])).toBe('/orders');
    expect(getAdminHomeRoute(['Order Manager'])).toBe('/orders');
    expect(canRefundOrders(['Support'])).toBe(false);
    expect(canRefundOrders(['Order Manager'])).toBe(true);
    expect(canRefundOrders(['staff'])).toBe(true);
  });

  it('allows Customers only for core administrators', async () => {
    for (const role of ['super_admin', 'admin', 'staff']) expect(canManageCustomers([role])).toBe(true);
    for (const role of ['Support', 'Order Manager', 'Product Manager']) expect(canManageCustomers([role])).toBe(false);

    const core = renderRoutes(['admin'], '/customers');
    await act(async () => await Promise.resolve());
    expect(core.host.textContent).toContain('Customers route');
    act(() => core.root.unmount());
    core.host.remove();
  });

  it.each([
    ['Support', ['Support'], 'Orders route'],
    ['Order Manager', ['Order Manager'], 'Orders route'],
    ['Product Manager', ['Product Manager'], 'Products route'],
  ])('renders the safe home fallback rather than Customers at /customers for %s', async (_role, userRoles, expectedRoute) => {
    const { host, root } = renderRoutes(userRoles, '/customers');
    await act(async () => await Promise.resolve());

    expect(host.textContent).toContain(expectedRoute);
    expect(host.textContent).not.toContain('Customers route');

    act(() => root.unmount());
    host.remove();
  });

  it.each([
    ['core administrator', ['admin'], 'Customer detail route'],
    ['Support', ['Support'], 'Orders route'],
    ['Order Manager', ['Order Manager'], 'Orders route'],
    ['Product Manager', ['Product Manager'], 'Products route'],
  ])('guards /customers/:id behind the existing Customers predicate for %s', async (_role, userRoles, expectedRoute) => {
    const { host, root } = renderRoutes(userRoles, '/customers/42');
    await act(async () => await Promise.resolve());

    expect(host.textContent).toContain(expectedRoute);
    if (expectedRoute !== 'Customer detail route') expect(host.textContent).not.toContain('Customer detail route');

    act(() => root.unmount());
    host.remove();
  });

  it.each(['super_admin', 'admin', 'staff'])('permits Discounts for core role %s', (role) => {
    expect(canManageDiscounts([role])).toBe(true);
  });

  it.each([
    ['Support', ['Support'], 'Orders route'],
    ['Order Manager', ['Order Manager'], 'Orders route'],
    ['Product Manager', ['Product Manager'], 'Products route'],
  ])('uses the existing safe home fallback rather than Discounts for %s', async (_role, userRoles, expectedRoute) => {
    expect(canManageDiscounts(userRoles)).toBe(false);
    const { host, root } = renderRoutes(userRoles, '/discounts');
    await act(async () => await Promise.resolve());

    expect(host.textContent).toContain(expectedRoute);
    expect(host.textContent).not.toContain('Discounts route');

    act(() => root.unmount());
    host.remove();
  });

  it('renders the Discounts list route for core administrators', async () => {
    const { host, root } = renderRoutes(['staff'], '/discounts');
    await act(async () => await Promise.resolve());
    expect(host.textContent).toContain('Discounts route');

    act(() => root.unmount());
    host.remove();
  });

  it.each(['/discounts/new', '/discounts/42'])('guards each Discount form route for core administrators', async (path) => {
    const { host, root } = renderRoutes(['admin'], path);
    await act(async () => await Promise.resolve());
    expect(host.textContent).toContain('Discount form route');

    act(() => root.unmount());
    host.remove();
  });

  it.each([
    ['Support', ['Support'], 'Orders route'],
    ['Order Manager', ['Order Manager'], 'Orders route'],
    ['Product Manager', ['Product Manager'], 'Products route'],
  ])('uses the existing safe fallback rather than either Discount form for %s', async (_role, userRoles, expectedRoute) => {
    for (const path of ['/discounts/new', '/discounts/42']) {
      const { host, root } = renderRoutes(userRoles, path);
      await act(async () => await Promise.resolve());
      expect(host.textContent).toContain(expectedRoute);
      expect(host.textContent).not.toContain('Discount form route');
      act(() => root.unmount());
      host.remove();
    }
  });

  it('routes /orders/new to the create form before the dynamic order route', async () => {
    const { host, root } = renderRoutes(['Order Manager'], '/orders/new');
    await act(async () => await Promise.resolve());
    expect(host.textContent).toContain('orders.create_title');
    act(() => root.unmount());
    host.remove();
  });

  it('allows Shipping routes only for core administrators', () => {
    expect(canManageShipping(['super_admin'])).toBe(true);
    expect(canManageShipping(['admin'])).toBe(true);
    expect(canManageShipping(['staff'])).toBe(true);
    expect(canManageShipping(['Order Manager'])).toBe(false);
    expect(canManageShipping(['Support'])).toBe(false);
    expect(canManageShipping(['Product Manager'])).toBe(false);
  });

  it('grants Reviews moderation to core admins, Support, and Product Manager but limits deletion to core admins', () => {
    expect(canManageReviews(['admin'])).toBe(true);
    expect(canManageReviews(['Support'])).toBe(true);
    expect(canManageReviews(['Product Manager'])).toBe(true);
    expect(canManageReviews(['Order Manager'])).toBe(false);
    expect(canDeleteReviews(['admin'])).toBe(true);
    expect(canDeleteReviews(['Support'])).toBe(false);
    expect(canDeleteReviews(['Product Manager'])).toBe(false);
  });

  it.each([
    ['core administrator', ['admin'], 'Reviews route delete=true'],
    ['Support', ['Support'], 'Reviews route delete=false'],
    ['Product Manager', ['Product Manager'], 'Reviews route delete=false'],
  ])('renders Reviews at /reviews for %s', async (_role, userRoles, expectedRoute) => {
    const { host, root } = renderRoutes(userRoles, '/reviews');
    await act(async () => await Promise.resolve());

    expect(host.textContent).toContain(expectedRoute);

    act(() => root.unmount());
    host.remove();
  });

  it('does not render a Reviews route for Order Manager', async () => {
    const { host, root } = renderRoutes(['Order Manager'], '/reviews');
    await act(async () => await Promise.resolve());

    expect(host.textContent).toContain('Orders route');
    expect(host.textContent).not.toContain('Reviews route');

    act(() => root.unmount());
    host.remove();
  });

  it.each([
    ['Support', ['Support'], 'Orders route'],
    ['Order Manager', ['Order Manager'], 'Orders route'],
    ['Product Manager', ['Product Manager'], 'Products route'],
  ])('renders the safe home fallback rather than Shipping at /shipping for %s', async (_role, userRoles, expectedRoute) => {
    const { host, root } = renderRoutes(userRoles);
    await act(async () => await Promise.resolve());

    expect(host.textContent).toContain(expectedRoute);
    expect(host.textContent).not.toContain('Shipping route');

    act(() => root.unmount());
    host.remove();
  });
});

describe('admin home route resolution', () => {
  it.each([
    ['super_admin', ['super_admin'], '/dashboard'],
    ['admin', ['admin'], '/dashboard'],
    ['staff', ['staff'], '/dashboard'],
    ['Product Manager', ['Product Manager'], '/products'],
    ['Order Manager', ['Order Manager'], '/orders'],
    ['Support', ['Support'], '/orders'],
  ])('routes role %s to its expected home destination %s', (_role, userRoles, expectedRoute) => {
    expect(getAdminHomeRoute(userRoles)).toBe(expectedRoute);
  });

  it('supports future dashboard route for core admin without altering specialized homes', () => {
    const isCoreAdmin = (roles: string[]) => roles.some((r) => ['super_admin', 'admin', 'staff'].includes(r));
    const futureCandidates: HomeRouteCandidate[] = [
      {
        path: '/dashboard',
        canAccess: isCoreAdmin,
      },
      ...ADMIN_HOME_CANDIDATES,
    ];

    expect(getAdminHomeRoute(['admin'], futureCandidates)).toBe('/dashboard');
    expect(getAdminHomeRoute(['super_admin'], futureCandidates)).toBe('/dashboard');
    expect(getAdminHomeRoute(['staff'], futureCandidates)).toBe('/dashboard');
    expect(getAdminHomeRoute(['Product Manager'], futureCandidates)).toBe('/products');
    expect(getAdminHomeRoute(['Order Manager'], futureCandidates)).toBe('/orders');
    expect(getAdminHomeRoute(['Support'], futureCandidates)).toBe('/orders');
  });

  it('redirects /dashboard to /dashboard/sales and renders SalesPage', async () => {
    const { host, root } = renderRoutes(['admin'], '/dashboard');
    await act(async () => await Promise.resolve());
    expect(host.textContent).toContain('Sales dashboard route');
    act(() => root.unmount());
    host.remove();
  });

  it('renders ConversionPage at /dashboard/conversion for authorized dashboard roles', async () => {
    for (const role of ['admin', 'Order Manager', 'Support']) {
      const { host, root } = renderRoutes([role], '/dashboard/conversion');
      await act(async () => await Promise.resolve());
      expect(host.textContent).toContain('Conversion dashboard route');
      act(() => root.unmount());
      host.remove();
    }

    const pm = renderRoutes(['Product Manager'], '/dashboard/conversion');
    await act(async () => await Promise.resolve());
    expect(pm.host.textContent).not.toContain('Conversion dashboard route');
    expect(pm.host.textContent).toContain('Products route');
    act(() => pm.root.unmount());
    pm.host.remove();
  });

  it('renders GoalsPage at /goals for core admin and falls back for Product Manager', async () => {
    const { host, root } = renderRoutes(['admin'], '/goals');
    await act(async () => await Promise.resolve());
    expect(host.textContent).toContain('Goals route');
    act(() => root.unmount());
    host.remove();

    const pm = renderRoutes(['Product Manager'], '/goals');
    await act(async () => await Promise.resolve());
    expect(pm.host.textContent).not.toContain('Goals route');
    expect(pm.host.textContent).toContain('Products route');
    act(() => pm.root.unmount());
    pm.host.remove();
  });

  it('renders ProfilePage at /profile for all authorized admin roles', async () => {
    for (const role of ['admin', 'Product Manager', 'Order Manager', 'Support']) {
      const { host, root } = renderRoutes([role], '/profile');
      await act(async () => await Promise.resolve());
      expect(host.textContent).toContain('Profile route');
      act(() => root.unmount());
      host.remove();
    }
  });

  it('renders SystemUsersPage at /system/users for core admin and falls back for Product Manager', async () => {
    const { host, root } = renderRoutes(['admin'], '/system/users');
    await act(async () => await Promise.resolve());
    expect(host.textContent).toContain('System users route');
    act(() => root.unmount());
    host.remove();

    const pm = renderRoutes(['Product Manager'], '/system/users');
    await act(async () => await Promise.resolve());
    expect(pm.host.textContent).not.toContain('System users route');
    expect(pm.host.textContent).toContain('Products route');
    act(() => pm.root.unmount());
    pm.host.remove();
  });

  it('renders MediaLibraryPage at /system/media for core admin and falls back for Product Manager', async () => {
    const { host, root } = renderRoutes(['admin'], '/system/media');
    await act(async () => await Promise.resolve());
    expect(host.textContent).toContain('Media library route');
    act(() => root.unmount());
    host.remove();

    const pm = renderRoutes(['Product Manager'], '/system/media');
    await act(async () => await Promise.resolve());
    expect(pm.host.textContent).not.toContain('Media library route');
    expect(pm.host.textContent).toContain('Products route');
    act(() => pm.root.unmount());
    pm.host.remove();
  });

  it('renders RolesPage at /system/roles for core admin and falls back for Product Manager', async () => {
    const { host, root } = renderRoutes(['admin'], '/system/roles');
    await act(async () => await Promise.resolve());
    expect(host.textContent).toContain('Roles route');
    act(() => root.unmount());
    host.remove();

    const pm = renderRoutes(['Product Manager'], '/system/roles');
    await act(async () => await Promise.resolve());
    expect(pm.host.textContent).not.toContain('Roles route');
    expect(pm.host.textContent).toContain('Products route');
    act(() => pm.root.unmount());
    pm.host.remove();
  });
});
