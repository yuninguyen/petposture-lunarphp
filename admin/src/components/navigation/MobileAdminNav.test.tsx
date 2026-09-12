import { act, createElement, createRef } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { MobileAdminNav } from './MobileAdminNav';
import { AdminNavGroup } from '@/navigation/adminNavigation';
import { BrandingContext } from '@/context/BrandingContext';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback ?? key,
    i18n: { language: 'en', changeLanguage: vi.fn() },
  }),
}));

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mockGroups: AdminNavGroup[] = [
  {
    key: 'sales',
    titleKey: 'sidebar.sales',
    fallbackTitle: 'SALES',
    items: [
      {
        key: 'orders',
        labelKey: 'orders.title',
        fallbackLabel: 'Orders',
        path: '/orders',
        icon: createElement('span', null, 'orders-icon'),
        canAccess: () => true,
      },
      {
        key: 'customers',
        labelKey: 'customers.title',
        fallbackLabel: 'Customers',
        path: '/customers',
        icon: createElement('span', null, 'customers-icon'),
        canAccess: () => true,
      },
    ],
  },
];

describe('MobileAdminNav component', () => {
  let host: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;
  let triggerButton: HTMLButtonElement;

  beforeEach(() => {
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);

    triggerButton = document.createElement('button');
    triggerButton.id = 'hamburger-button';
    document.body.appendChild(triggerButton);

    // jsdom does not implement matchMedia; components that call it directly
    // (the resize-to-desktop auto-close effect) crash on mount without a stub.
    vi.stubGlobal('matchMedia', vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })));
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    host.remove();
    triggerButton.remove();
    document.body.style.overflow = '';
    vi.unstubAllGlobals();
  });

  function renderNav(props: {
    open: boolean;
    onClose?: () => void;
    groups?: AdminNavGroup[];
    initialRoute?: string;
  }) {
    const triggerRef = { current: triggerButton };
    act(() => {
      root.render(
        createElement(
          MemoryRouter,
          { initialEntries: [props.initialRoute ?? '/orders'] },
          createElement(
            BrandingContext.Provider,
            { value: { name: 'PetPosture', logoUrl: '/logo.png', faviconUrl: '/favicon.png' } },
            createElement(MobileAdminNav, {
              open: props.open,
              onClose: props.onClose ?? vi.fn(),
              groups: props.groups ?? mockGroups,
              userName: 'TestAdmin',
              triggerRef,
            })
          )
        )
      );
    });
  }

  it('renders nothing when closed', () => {
    renderNav({ open: false });
    expect(document.querySelector('#mobile-admin-drawer')).toBeNull();
  });

  it('renders dialog with accessible attributes, authorized links, and active state when open', () => {
    renderNav({ open: true, initialRoute: '/orders' });

    const dialog = document.querySelector('#mobile-admin-drawer');
    expect(dialog).not.toBeNull();
    expect(dialog?.getAttribute('role')).toBe('dialog');
    expect(dialog?.getAttribute('aria-modal')).toBe('true');
    expect(dialog?.getAttribute('aria-label')).toBe('Admin navigation');

    // Authorized links
    const ordersLink = dialog?.querySelector('a[href="/orders"]');
    const customersLink = dialog?.querySelector('a[href="/customers"]');
    expect(ordersLink).not.toBeNull();
    expect(customersLink).not.toBeNull();
    expect(ordersLink?.textContent).toContain('Orders');
    expect(customersLink?.textContent).toContain('Customers');
  });

  it('applies scroll lock to document body when open and releases on close', () => {
    expect(document.body.style.overflow).toBe('');

    renderNav({ open: true });
    expect(document.body.style.overflow).toBe('hidden');

    renderNav({ open: false });
    expect(document.body.style.overflow).toBe('');
  });

  it('restores scroll lock upon unmount', () => {
    renderNav({ open: true });
    expect(document.body.style.overflow).toBe('hidden');

    act(() => root.unmount());
    expect(document.body.style.overflow).toBe('');
  });

  it('focuses the close button when opened', async () => {
    renderNav({ open: true });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    const closeBtn = document.querySelector('[data-testid="mobile-nav-close"]') as HTMLButtonElement;
    expect(document.activeElement).toBe(closeBtn);
  });

  it('manually closing via close button calls onClose and returns focus to hamburger trigger', () => {
    const onClose = vi.fn();
    renderNav({ open: true, onClose });

    triggerButton.focus();
    expect(document.activeElement).toBe(triggerButton);

    const closeBtn = document.querySelector('[data-testid="mobile-nav-close"]') as HTMLButtonElement;
    act(() => {
      closeBtn.click();
    });

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(triggerButton);
  });

  it('manually closing via backdrop click calls onClose and returns focus to hamburger trigger', () => {
    const onClose = vi.fn();
    renderNav({ open: true, onClose });

    const backdrop = document.querySelector('[data-testid="mobile-nav-backdrop"]') as HTMLDivElement;
    act(() => {
      backdrop.click();
    });

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(triggerButton);
  });

  it('manually closing via Escape key calls onClose and returns focus to hamburger trigger', () => {
    const onClose = vi.fn();
    renderNav({ open: true, onClose });

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(triggerButton);
  });

  it('clicking a route navigation link calls onClose WITHOUT returning focus to hamburger', () => {
    const onClose = vi.fn();
    renderNav({ open: true, onClose });

    const ordersLink = document.querySelector('a[href="/orders"]') as HTMLAnchorElement;
    act(() => {
      ordersLink.click();
    });

    expect(onClose).toHaveBeenCalledTimes(1);
    // Focus should NOT be returned to the hamburger trigger button
    expect(document.activeElement).not.toBe(triggerButton);
  });

  it('traps tab focus within the drawer dialog', () => {
    renderNav({ open: true });

    const dialog = document.querySelector('#mobile-admin-drawer') as HTMLDivElement;
    const focusable = dialog.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    expect(focusable.length).toBeGreaterThan(1);

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    // Focus last element and press Tab -> should cycle to first
    last.focus();
    expect(document.activeElement).toBe(last);

    act(() => {
      dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    });
    expect(document.activeElement).toBe(first);

    // Focus first element and press Shift+Tab -> should cycle to last
    first.focus();
    expect(document.activeElement).toBe(first);

    act(() => {
      dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true }));
    });
    expect(document.activeElement).toBe(last);
  });

  it('auto-closes drawer and releases scroll lock when window is resized to desktop (>= 768px)', () => {
    let mediaChangeHandler: ((e: { matches: boolean }) => void) | null = null;

    vi.spyOn(window, 'matchMedia').mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn((event: string, handler: any) => {
        if (event === 'change') mediaChangeHandler = handler;
      }),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    const onClose = vi.fn();
    renderNav({ open: true, onClose });
    expect(document.body.style.overflow).toBe('hidden');

    // Simulate resizing across md breakpoint
    act(() => {
      if (mediaChangeHandler) {
        mediaChangeHandler({ matches: true });
      }
    });

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
