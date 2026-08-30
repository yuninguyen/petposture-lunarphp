import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ navigate: vi.fn(), useCustomers: vi.fn() }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('react-router-dom', () => ({ useNavigate: () => mocks.navigate }));
vi.mock('./api', () => ({ useCustomers: (...args: unknown[]) => mocks.useCustomers(...args) }));

import { CustomersListPage } from './CustomersListPage';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function renderPage() {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  act(() => root.render(createElement(CustomersListPage)));
  return { host, root };
}

function customerPage(page: number) {
  return {
    isLoading: false,
    isError: false,
    data: {
      data: [
        { id: 42, name: 'Guest Customer', email: null, orders_count: 1, orders_sum_total: 1299, created_at: '2026-08-30T12:00:00Z', status: 'active' },
        { id: 43, name: 'Inactive Taylor', email: 'taylor@example.com', orders_count: 3, orders_sum_total: 2500, created_at: '2026-08-29T12:00:00Z', status: 'inactive' },
      ],
      meta: { current_page: page, last_page: 3, per_page: 15, total: 32 },
    },
  };
}

describe('CustomersListPage', () => {
  it('renders Guest, inactive status, minor-unit totals, and customer navigation', () => {
    mocks.navigate.mockReset();
    mocks.useCustomers.mockReturnValue(customerPage(1));
    const { host, root } = renderPage();

    expect(host.textContent).toContain('customers.guest');
    expect(host.textContent).toContain('inactive');
    expect(host.textContent).toContain('$12.99');
    const inactiveStatus = Array.from(host.querySelectorAll('span')).find((span) => span.textContent === 'customers.status_inactive')!;
    expect(inactiveStatus).toBeTruthy();
    expect(inactiveStatus.className).toContain('inline-flex');
    expect(inactiveStatus.className).toContain('rounded-full');

    const customer = Array.from(host.querySelectorAll('button')).find((button) => button.textContent === 'Guest Customer')!;
    act(() => customer.click());
    expect(mocks.navigate).toHaveBeenCalledWith('/customers/42');

    act(() => root.unmount());
    host.remove();
  });

  it('issues only a page-one query when search changes from page two', () => {
    mocks.useCustomers.mockImplementation(({ page }: { page: number }) => customerPage(page));
    const { host, root } = renderPage();

    const next = Array.from(host.querySelectorAll('button')).find((button) => button.textContent === 'customers.next')!;
    act(() => next.click());
    expect(mocks.useCustomers).toHaveBeenLastCalledWith({ search: '', status: undefined, page: 2 });
    mocks.useCustomers.mockClear();

    const search = host.querySelector('input') as HTMLInputElement;
    act(() => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(search, 'Taylor');
      search.dispatchEvent(new Event('input', { bubbles: true }));
      search.dispatchEvent(new Event('change', { bubbles: true }));
    });

    expect(mocks.useCustomers).toHaveBeenCalledWith({ search: 'Taylor', status: undefined, page: 1 });
    expect(mocks.useCustomers).not.toHaveBeenCalledWith({ search: 'Taylor', status: undefined, page: 2 });

    act(() => root.unmount());
    host.remove();
  });

  it('issues only a page-one query when status changes from page two', () => {
    mocks.useCustomers.mockImplementation(({ page }: { page: number }) => customerPage(page));
    const { host, root } = renderPage();

    const next = Array.from(host.querySelectorAll('button')).find((button) => button.textContent === 'customers.next')!;
    act(() => next.click());
    expect(mocks.useCustomers).toHaveBeenLastCalledWith({ search: '', status: undefined, page: 2 });
    mocks.useCustomers.mockClear();

    const status = host.querySelector('select') as HTMLSelectElement;
    act(() => {
      status.value = 'inactive';
      status.dispatchEvent(new Event('change', { bubbles: true }));
    });

    expect(mocks.useCustomers).toHaveBeenCalledWith({ search: '', status: 'inactive', page: 1 });
    expect(mocks.useCustomers).not.toHaveBeenCalledWith({ search: '', status: 'inactive', page: 2 });

    act(() => root.unmount());
    host.remove();
  });
});
