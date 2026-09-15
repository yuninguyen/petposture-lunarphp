import React from 'react';

export type AdminNavGroupKey = 'sales' | 'content' | 'catalogue' | string;

export interface AdminNavItem {
  key: string;
  labelKey: string;
  fallbackLabel: string;
  path: string;
  icon: React.ReactNode;
  children?: AdminNavItem[];
  canAccess: (roles: string[]) => boolean;
}

export interface AdminNavGroup {
  key: AdminNavGroupKey;
  titleKey: string;
  fallbackTitle: string;
  canAccess?: (roles: string[]) => boolean;
  items: AdminNavItem[];
}

export function isCoreAdminRole(roles: string[]): boolean {
  return roles.some((role) => ['super_admin', 'admin', 'staff'].includes(role));
}

export function canAccessOrders(roles: string[]): boolean {
  return isCoreAdminRole(roles) || roles.includes('Order Manager') || roles.includes('Support');
}

export function canAccessReviews(roles: string[]): boolean {
  return isCoreAdminRole(roles) || roles.includes('Support') || roles.includes('Product Manager');
}

export function canAccessCatalogue(roles: string[]): boolean {
  return isCoreAdminRole(roles) || roles.includes('Product Manager');
}

export function canAccessDashboard(roles: string[]): boolean {
  return isCoreAdminRole(roles) || roles.includes('Order Manager') || roles.includes('Support');
}

export function canAccessFinance(roles: string[]): boolean {
  return isCoreAdminRole(roles);
}

export const ADMIN_NAV_GROUPS: AdminNavGroup[] = [
  {
    key: 'dashboard',
    titleKey: 'sidebar.dashboard',
    fallbackTitle: 'DASHBOARD',
    canAccess: canAccessDashboard,
    items: [
      {
        key: 'sales',
        labelKey: 'nav.sales',
        fallbackLabel: 'Sales',
        path: '/dashboard/sales',
        icon: (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        ),
        canAccess: canAccessDashboard,
      },
      {
        key: 'conversion',
        labelKey: 'nav.conversion',
        fallbackLabel: 'Conversion Report',
        path: '/dashboard/conversion',
        icon: (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
          </svg>
        ),
        canAccess: canAccessDashboard,
      },
    ],
  },
  {
    key: 'sales',
    titleKey: 'sidebar.sales',
    fallbackTitle: 'SALES',
    canAccess: (roles) => isCoreAdminRole(roles) || roles.includes('Order Manager') || roles.includes('Support') || roles.includes('Product Manager'),
    items: [
      {
        key: 'orders',
        labelKey: 'orders.title',
        fallbackLabel: 'Orders',
        path: '/orders',
        icon: (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 7h18M6 3h12v4H6V3zm0 4h12v10H6V7zm3 4h6m-6 3h4" />
          </svg>
        ),
        canAccess: canAccessOrders,
      },
      {
        key: 'return-requests',
        labelKey: 'return_requests.title',
        fallbackLabel: 'Return Requests',
        path: '/return-requests',
        icon: (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 14l-4-4 4-4m-4 4h10a4 4 0 010 8h-1" />
          </svg>
        ),
        canAccess: canAccessOrders,
      },
      {
        key: 'reviews',
        labelKey: 'reviews.title',
        fallbackLabel: 'Reviews',
        path: '/reviews',
        icon: (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        ),
        canAccess: canAccessReviews,
      },
      {
        key: 'customers',
        labelKey: 'customers.title',
        fallbackLabel: 'Customers',
        path: '/customers',
        icon: (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2m18 0v-2a4 4 0 00-3-3.87m-4-12a4 4 0 010 7.75M9 11a4 4 0 100-8 4 4 0 000 8z" />
          </svg>
        ),
        canAccess: isCoreAdminRole,
      },
      {
        key: 'shipping',
        labelKey: 'shipping.title',
        fallbackLabel: 'Shipping',
        path: '/shipping',
        icon: (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7h-9m9 5h-9m9 5h-9M7 7h.01M7 12h.01M7 17h.01" />
          </svg>
        ),
        canAccess: isCoreAdminRole,
      },
      {
        key: 'discounts',
        labelKey: 'discounts.title',
        fallbackLabel: 'Discounts',
        path: '/discounts',
        icon: (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v8m-4-4h8M5 4h14a1 1 0 011 1v14a1 1 0 01-1 1H5a1 1 0 01-1-1V5a1 1 0 011-1z" />
          </svg>
        ),
        canAccess: isCoreAdminRole,
      },
    ],
  },
  {
    key: 'content',
    titleKey: 'sidebar.content',
    fallbackTitle: 'CONTENT',
    canAccess: isCoreAdminRole,
    items: [
      {
        key: 'blog-categories',
        labelKey: 'blog_categories.title',
        fallbackLabel: 'Blog Categories',
        path: '/blog-categories',
        icon: (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
          </svg>
        ),
        canAccess: isCoreAdminRole,
      },
      {
        key: 'posts',
        labelKey: 'nav.posts',
        fallbackLabel: 'Posts',
        path: '/posts',
        icon: (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10l6 6v10a2 2 0 01-2 2z" />
          </svg>
        ),
        canAccess: isCoreAdminRole,
      },
      {
        key: 'comments',
        labelKey: 'comments.title',
        fallbackLabel: 'Comments',
        path: '/comments',
        icon: (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
        ),
        canAccess: isCoreAdminRole,
      },
      {
        key: 'tags',
        labelKey: 'tags.title',
        fallbackLabel: 'Tags',
        path: '/tags',
        icon: (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
          </svg>
        ),
        canAccess: isCoreAdminRole,
      },
      {
        key: 'seo-social',
        labelKey: 'seo_social.title',
        fallbackLabel: 'SEO & Social',
        path: '/seo-social',
        icon: (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        ),
        canAccess: isCoreAdminRole,
      },
      {
        key: 'legal-policies',
        labelKey: 'pages.title',
        fallbackLabel: 'Legal & Policies',
        path: '/legal-policies',
        icon: (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        ),
        canAccess: isCoreAdminRole,
      },
    ],
  },
  {
    key: 'catalogue',
    titleKey: 'sidebar.catalogue',
    fallbackTitle: 'CATALOGUE',
    canAccess: canAccessCatalogue,
    items: [
      {
        key: 'products',
        labelKey: 'products.title',
        fallbackLabel: 'Products',
        path: '/products',
        icon: (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
        ),
        canAccess: canAccessCatalogue,
      },
      {
        key: 'product-types',
        labelKey: 'product_types.title',
        fallbackLabel: 'Product Types',
        path: '/product-types',
        icon: (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0-8 5-8-5m16 0-8 5m-8-5 8 5m0 0v3" />
          </svg>
        ),
        canAccess: canAccessCatalogue,
      },
      {
        key: 'custom-fields',
        labelKey: 'custom_fields.title',
        fallbackLabel: 'Custom Fields',
        path: '/custom-fields',
        icon: (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h10M4 18h7m6-8v8m-4-4h8" />
          </svg>
        ),
        canAccess: canAccessCatalogue,
      },
      {
        key: 'brands',
        labelKey: 'brands.title',
        fallbackLabel: 'Brands',
        path: '/brands',
        icon: (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 7h10v10H7zM4 4h16v16H4z" />
          </svg>
        ),
        canAccess: canAccessCatalogue,
      },
      {
        key: 'collection-groups',
        labelKey: 'collection_groups.title',
        fallbackLabel: 'Collection Groups',
        path: '/collection-groups',
        icon: (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h10" />
          </svg>
        ),
        canAccess: canAccessCatalogue,
        children: [
          {
            key: 'collections',
            labelKey: 'collections.title',
            fallbackLabel: 'Collections',
            path: '/collections',
            icon: (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3v4m0 0H6a2 2 0 00-2 2v2m8-4h6a2 2 0 012 2v2m-8-4v4M2 15h4v4H2v-4zm8 0h4v4h-4v-4zm8 0h4v4h-4v-4z" />
              </svg>
            ),
            canAccess: canAccessCatalogue,
          },
        ],
      },
      {
        key: 'breeds',
        labelKey: 'breeds.title',
        fallbackLabel: 'Breeds',
        path: '/breeds',
        icon: (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 10l-2 1m0 0l-2-1m2 1v2.5M20 7l-2 1m2-1l-2-1m2 1v2.5M14 4l-2-1-2 1M4 7l2-1M4 7l2 1M4 7v2.5M12 21l-2-1m2 1l2-1m-2 1v-2.5M6 18l-2-1v-2.5M18 18l2-1v-2.5" />
          </svg>
        ),
        canAccess: canAccessCatalogue,
      },
      {
        key: 'solutions',
        labelKey: 'solutions.title',
        fallbackLabel: 'Solutions',
        path: '/solutions',
        icon: (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
          </svg>
        ),
        canAccess: canAccessCatalogue,
      },
    ],
  },
  {
    key: 'finance',
    titleKey: 'sidebar.finance',
    fallbackTitle: 'FINANCE',
    canAccess: canAccessFinance,
    items: [
      {
        key: 'goals',
        labelKey: 'nav.goals',
        fallbackLabel: 'Goals',
        path: '/goals',
        icon: (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
          </svg>
        ),
        canAccess: canAccessFinance,
      },
    ],
  },
  {
    key: 'system',
    titleKey: 'sidebar.system',
    fallbackTitle: 'SYSTEM',
    canAccess: isCoreAdminRole,
    items: [
      {
        key: 'users',
        labelKey: 'system_users.title',
        fallbackLabel: 'Users',
        path: '/system/users',
        icon: (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
        ),
        canAccess: isCoreAdminRole,
      },
      {
        key: 'media',
        labelKey: 'media_library.title',
        fallbackLabel: 'Media Library',
        path: '/system/media',
        icon: (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        ),
        canAccess: isCoreAdminRole,
      },
      {
        key: 'roles',
        labelKey: 'system_roles.title',
        fallbackLabel: 'Roles & Permissions',
        path: '/system/roles',
        icon: (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
        ),
        canAccess: isCoreAdminRole,
      },
    ],
  },
];

export function getVisibleNavigation(roles: string[]): AdminNavGroup[] {
  return ADMIN_NAV_GROUPS
    .filter((group) => !group.canAccess || group.canAccess(roles))
    .map((group) => ({
      ...group,
      items: group.items
        .filter((item) => item.canAccess(roles))
        .map((item) => ({
          ...item,
          children: item.children ? item.children.filter((child) => child.canAccess(roles)) : undefined,
        })),
    }))
    .filter((group) => group.items.length > 0);
}
