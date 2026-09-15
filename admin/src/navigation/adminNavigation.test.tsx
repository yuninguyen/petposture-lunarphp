import { describe, expect, it } from 'vitest';
import {
  ADMIN_NAV_GROUPS,
  getVisibleNavigation,
  isCoreAdminRole,
  canAccessOrders,
  canAccessReviews,
  canAccessCatalogue,
  canAccessDashboard,
  canAccessFinance,
  AdminNavGroup,
} from './adminNavigation';

describe('admin navigation semantic authorization', () => {
  it('correctly identifies core admin roles', () => {
    expect(isCoreAdminRole(['super_admin'])).toBe(true);
    expect(isCoreAdminRole(['admin'])).toBe(true);
    expect(isCoreAdminRole(['staff'])).toBe(true);
    expect(isCoreAdminRole(['Product Manager'])).toBe(false);
    expect(isCoreAdminRole(['Order Manager'])).toBe(false);
    expect(isCoreAdminRole(['Support'])).toBe(false);
    expect(isCoreAdminRole([])).toBe(false);
  });

  it('correctly checks role capability predicates', () => {
    // Orders / Return Requests
    expect(canAccessOrders(['admin'])).toBe(true);
    expect(canAccessOrders(['Order Manager'])).toBe(true);
    expect(canAccessOrders(['Support'])).toBe(true);
    expect(canAccessOrders(['Product Manager'])).toBe(false);

    // Reviews
    expect(canAccessReviews(['admin'])).toBe(true);
    expect(canAccessReviews(['Support'])).toBe(true);
    expect(canAccessReviews(['Product Manager'])).toBe(true);
    expect(canAccessReviews(['Order Manager'])).toBe(false);

    // Catalogue
    expect(canAccessCatalogue(['admin'])).toBe(true);
    expect(canAccessCatalogue(['Product Manager'])).toBe(true);
    expect(canAccessCatalogue(['Order Manager'])).toBe(false);
    expect(canAccessCatalogue(['Support'])).toBe(false);

    // Dashboard & Finance
    expect(canAccessDashboard(['admin'])).toBe(true);
    expect(canAccessDashboard(['Order Manager'])).toBe(true);
    expect(canAccessDashboard(['Support'])).toBe(true);
    expect(canAccessDashboard(['Product Manager'])).toBe(false);

    expect(canAccessFinance(['admin'])).toBe(true);
    expect(canAccessFinance(['staff'])).toBe(true);
    expect(canAccessFinance(['Order Manager'])).toBe(false);
    expect(canAccessFinance(['Product Manager'])).toBe(false);
  });

  it('exposes all groups and all items to core admin', () => {
    const groups = getVisibleNavigation(['admin']);
    expect(groups.map((g) => g.key)).toEqual(['dashboard', 'sales', 'finance', 'catalogue', 'content', 'affiliate', 'system']);

    const dashboardItems = groups.find((g) => g.key === 'dashboard')?.items.map((i) => i.path);
    expect(dashboardItems).toEqual(['/dashboard/sales', '/dashboard/conversion']);

    const salesItems = groups.find((g) => g.key === 'sales')?.items.map((i) => i.path);
    expect(salesItems).toEqual([
      '/orders',
      '/return-requests',
      '/reviews',
      '/customers',
      '/shipping',
      '/discounts',
    ]);

    const contentItems = groups.find((g) => g.key === 'content')?.items.map((i) => i.path);
    expect(contentItems).toEqual([
      '/blog-categories',
      '/posts',
      '/comments',
      '/tags',
      '/seo-social',
      '/legal-policies',
    ]);

    const catalogueItems = groups.find((g) => g.key === 'catalogue')?.items.map((i) => i.path);
    expect(catalogueItems).toEqual([
      '/products',
      '/product-types',
      '/custom-fields',
      '/brands',
      '/collection-groups',
      '/breeds',
      '/solutions',
    ]);

    const financeItems = groups.find((g) => g.key === 'finance')?.items.map((i) => i.path);
    expect(financeItems).toEqual(['/goals']);

    const affiliateItems = groups.find((g) => g.key === 'affiliate')?.items.map((i) => i.path);
    expect(affiliateItems).toEqual(['/affiliate/reports', '/affiliate/networks']);

    const systemItems = groups.find((g) => g.key === 'system')?.items.map((i) => i.path);
    expect(systemItems).toEqual(['/system/users', '/system/roles', '/system/media', '/system/activity-logs']);
  });

  it('exposes dashboard and orders to Order Manager', () => {
    const groups = getVisibleNavigation(['Order Manager']);
    expect(groups.map((g) => g.key)).toEqual(['dashboard', 'sales']);

    expect(groups[0].items.map((i) => i.path)).toEqual(['/dashboard/sales', '/dashboard/conversion']);
    expect(groups[1].items.map((i) => i.path)).toEqual(['/orders', '/return-requests']);
  });

  it('exposes dashboard, orders, return requests, and reviews to Support', () => {
    const groups = getVisibleNavigation(['Support']);
    expect(groups.map((g) => g.key)).toEqual(['dashboard', 'sales']);

    expect(groups[0].items.map((i) => i.path)).toEqual(['/dashboard/sales', '/dashboard/conversion']);
    expect(groups[1].items.map((i) => i.path)).toEqual(['/orders', '/return-requests', '/reviews']);
  });

  it('exposes reviews and full catalogue to Product Manager without content or orders', () => {
    const groups = getVisibleNavigation(['Product Manager']);
    expect(groups.map((g) => g.key)).toEqual(['sales', 'catalogue']);

    const salesItems = groups.find((g) => g.key === 'sales')?.items.map((i) => i.path);
    expect(salesItems).toEqual(['/reviews']);

    const catalogueItems = groups.find((g) => g.key === 'catalogue')?.items.map((i) => i.path);
    expect(catalogueItems).toEqual([
      '/products',
      '/product-types',
      '/custom-fields',
      '/brands',
      '/collection-groups',
      '/breeds',
      '/solutions',
    ]);
  });

  it('returns empty array for unknown or unauthorized roles', () => {
    expect(getVisibleNavigation(['guest'])).toEqual([]);
    expect(getVisibleNavigation([])).toEqual([]);
  });

  it('proves inserting or reordering groups does not alter role permissions', () => {
    // Simulate inserting a new group at beginning or middle
    const dummyNewGroup: AdminNavGroup = {
      key: 'system',
      titleKey: 'sidebar.system',
      fallbackTitle: 'SYSTEM',
      canAccess: isCoreAdminRole,
      items: [
        {
          key: 'settings',
          labelKey: 'settings.title',
          fallbackLabel: 'Settings',
          path: '/settings',
          canAccess: isCoreAdminRole,
          icon: null,
        },
      ],
    };

    const reorderedGroups = [dummyNewGroup, ...ADMIN_NAV_GROUPS];

    // Order Manager still only gets dashboard & sales groups regardless of array index
    const visibleForOrderManager = reorderedGroups
      .filter((g) => !g.canAccess || g.canAccess(['Order Manager']))
      .map((g) => ({
        ...g,
        items: g.items.filter((i) => i.canAccess(['Order Manager'])),
      }))
      .filter((g) => g.items.length > 0);

    expect(visibleForOrderManager.map((g) => g.key)).toEqual(['dashboard', 'sales']);
    expect(visibleForOrderManager[0].items.map((i) => i.path)).toEqual(['/dashboard/sales', '/dashboard/conversion']);
    expect(visibleForOrderManager[1].items.map((i) => i.path)).toEqual(['/orders', '/return-requests']);
  });
});
