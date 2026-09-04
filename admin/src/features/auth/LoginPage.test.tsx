import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en', changeLanguage: vi.fn() } }),
}));
vi.mock('@/lib/auth', () => ({
  login: vi.fn(),
  isAdminRole: () => true,
}));

import { LoginPage } from './LoginPage';
import { BrandingContext } from '@/context/BrandingContext';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function render(branding?: { name: string; logoUrl: string; faviconUrl: string }) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  act(() => root.render(createElement(BrandingContext.Provider, { value: branding ?? { name: 'PetPosture', logoUrl: '/logo.png', faviconUrl: '/favicon.png' } }, createElement(LoginPage, { onLoggedIn: vi.fn() }))));
  return { host, root };
}

describe('LoginPage admin branding', () => {
  it('renders configured logo on desktop and mobile', () => {
    const view = render({ name: 'Custom', logoUrl: '/custom-logo.png', faviconUrl: '/favicon.png' });
    expect(view.host.querySelectorAll('img[src="/custom-logo.png"]')).toHaveLength(2);
    act(() => view.root.unmount());
    view.host.remove();
  });

  it('keeps the static logo fallback', () => {
    const view = render();
    expect(view.host.querySelectorAll('img[src="/logo.png"]')).toHaveLength(2);
    act(() => view.root.unmount());
    view.host.remove();
  });
});
