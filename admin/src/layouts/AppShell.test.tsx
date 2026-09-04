import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en', changeLanguage: vi.fn() } }),
}));

import { AppShell } from './AppShell';
import { BrandingContext } from '@/context/BrandingContext';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function renderShell(userRoles: string[], logoUrl = '/logo.png') {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  act(() => root.render(createElement(MemoryRouter, null, createElement(BrandingContext.Provider, { value: { name: 'PetPosture', logoUrl, faviconUrl: '/favicon.png' } }, createElement(AppShell, { userName: 'Admin', userRoles, children: createElement('div') })))));
  return { host, root };
}

describe('AppShell branding', () => {
  it('renders the configured logo', () => {
    const shell = renderShell(['admin'], '/custom-admin-logo.png');
    expect(shell.host.querySelector('img')?.getAttribute('src')).toBe('/custom-admin-logo.png');
    act(() => shell.root.unmount());
    shell.host.remove();
  });

  it('renders the static logo fallback', () => {
    const shell = renderShell(['admin']);
    expect(shell.host.querySelector('img')?.getAttribute('src')).toBe('/logo.png');
    act(() => shell.root.unmount());
    shell.host.remove();
  });
});

describe('AppShell sales navigation', () => {
  it.each([
    ['super_admin', ['super_admin'], true, true, true, true, true],
    ['admin', ['admin'], true, true, true, true, true],
    ['staff', ['staff'], true, true, true, true, true],
    ['Support', ['Support'], false, false, true, true, false],
    ['Order Manager', ['Order Manager'], false, false, true, true, false],
    ['Product Manager', ['Product Manager'], false, false, false, false, false],
  ])('applies core-only Customers, Shipping, and Discounts visibility for %s while retaining Sales policy', (_role, userRoles, customersVisible, shippingVisible, ordersVisible, returnsVisible, discountsVisible) => {
    const shell = renderShell(userRoles);

    expect(shell.host.querySelector('a[href="/customers"]') !== null).toBe(customersVisible);
    expect(shell.host.querySelector('a[href="/shipping"]') !== null).toBe(shippingVisible);
    expect(shell.host.querySelector('a[href="/orders"]') !== null).toBe(ordersVisible);
    expect(shell.host.querySelector('a[href="/return-requests"]') !== null).toBe(returnsVisible);
    expect(shell.host.querySelector('a[href="/discounts"]') !== null).toBe(discountsVisible);

    act(() => shell.root.unmount());
    shell.host.remove();
  });

  it('shows Order Manager the Orders and Returns links without Shipping', () => {
    const orderManager = renderShell(['Order Manager']);

    expect(orderManager.host.querySelector('a[href="/customers"]')).toBeNull();
    expect(orderManager.host.querySelector('a[href="/orders"]')).not.toBeNull();
    expect(orderManager.host.querySelector('a[href="/return-requests"]')).not.toBeNull();
    expect(orderManager.host.querySelector('a[href="/shipping"]')).toBeNull();

    act(() => orderManager.root.unmount());
    orderManager.host.remove();
  });

  it.each([
    ['core administrator', ['admin'], true],
    ['Support', ['Support'], true],
    ['Product Manager', ['Product Manager'], true],
    ['Order Manager', ['Order Manager'], false],
  ])('shows Reviews in Sales navigation for %s only when permitted', (_role, userRoles, visible) => {
    const shell = renderShell(userRoles);

    expect(shell.host.querySelector('a[href="/reviews"]') !== null).toBe(visible);

    act(() => shell.root.unmount());
    shell.host.remove();
  });
});
