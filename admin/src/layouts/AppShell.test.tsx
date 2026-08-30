import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en', changeLanguage: vi.fn() } }),
}));

import { AppShell } from './AppShell';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function renderShell(userRoles: string[]) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  act(() => root.render(createElement(MemoryRouter, null, createElement(AppShell, { userName: 'Admin', userRoles, children: createElement('div') }))));
  return { host, root };
}

describe('AppShell sales navigation', () => {
  it('shows Shipping only to core administrators while preserving Sales links for commerce roles', () => {
    const core = renderShell(['admin']);
    expect(core.host.querySelector('a[href="/shipping"]')).not.toBeNull();
    expect(core.host.querySelector('a[href="/orders"]')).not.toBeNull();
    act(() => core.root.unmount());
    core.host.remove();

    const support = renderShell(['Support']);
    expect(support.host.querySelector('a[href="/shipping"]')).toBeNull();
    expect(support.host.querySelector('a[href="/orders"]')).not.toBeNull();
    expect(support.host.querySelector('a[href="/return-requests"]')).not.toBeNull();
    act(() => support.root.unmount());
    support.host.remove();
  });

  it('shows Order Manager the Orders and Returns links without Shipping', () => {
    const orderManager = renderShell(['Order Manager']);

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
