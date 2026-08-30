import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

vi.mock('./features/orders/OrdersListPage', () => ({ OrdersListPage: () => createElement('div', null, 'Orders route') }));
vi.mock('./features/products/ProductsListPage', () => ({ ProductsListPage: () => createElement('div', null, 'Products route') }));
vi.mock('./features/shipping/ShippingMethodsPage', () => ({ ShippingMethodsPage: () => createElement('div', null, 'Shipping route') }));
vi.mock('./features/reviews/ReviewsPage', () => ({ ReviewsPage: ({ canDelete }: { canDelete: boolean }) => createElement('div', null, `Reviews route delete=${canDelete}`) }));

import { AppRoutes, canDeleteReviews, canManageCommerce, canManageReviews, canManageShipping, canRefundOrders, getAdminHomeRoute } from './App';

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
