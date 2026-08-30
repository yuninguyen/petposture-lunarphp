import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  useCustomer: vi.fn(),
  useCustomerOrders: vi.fn(),
  useCustomerAddresses: vi.fn(),
  useCustomerLoginAccounts: vi.fn(),
}));

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('./api', () => ({
  useCustomer: (...args: unknown[]) => mocks.useCustomer(...args),
  useCustomerOrders: (...args: unknown[]) => mocks.useCustomerOrders(...args),
  useCustomerAddresses: (...args: unknown[]) => mocks.useCustomerAddresses(...args),
  useCustomerLoginAccounts: (...args: unknown[]) => mocks.useCustomerLoginAccounts(...args),
}));

import { CustomerDetailPage } from './CustomerDetailPage';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const customer = { id: 42, name: 'Taylor Customer', email: 'taylor@example.com', orders_count: 2, orders_sum_total: 12999, created_at: '2026-08-31T10:00:00Z', status: 'active' as const };
const orders = { data: [{ id: '100', reference: 'ORD-100', status: 'shipped', status_label: 'Shipped', total: { formatted: '$129.99 USD', decimal: 129.99, currency: 'USD' }, created_at: '2026-08-31 10:00:00' }], meta: { current_page: 1, last_page: 2, per_page: 15, total: 16 } };
const addresses = [{ id: 1, title: 'Home', first_name: 'Taylor', last_name: 'Customer', line_one: '1 Main Street', line_two: null, line_three: null, city: 'Hanoi', state: null, postcode: '10000', contact_phone: '0123456789', contact_email: 'address@example.com', shipping_default: true, billing_default: true, created_at: '2026-08-31T10:00:00Z' }];
const accounts = [{ id: 7, email: 'login@example.com' }];

function query(data: unknown) { return { isLoading: false, isError: false, data }; }

function renderPage() {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  act(() => root.render(createElement(MemoryRouter, { initialEntries: ['/customers/42'] }, createElement(Routes, null, createElement(Route, { path: '/customers/:id', element: createElement(CustomerDetailPage) })))));
  return { host, root };
}

function resetHooks() {
  mocks.useCustomer.mockReset().mockReturnValue(query(customer));
  mocks.useCustomerOrders.mockReset().mockReturnValue(query(orders));
  mocks.useCustomerAddresses.mockReset().mockReturnValue(query(addresses));
  mocks.useCustomerLoginAccounts.mockReset().mockReturnValue(query(accounts));
}

describe('CustomerDetailPage', () => {
  it('loads the summary and enables only Orders initially', () => {
    resetHooks();
    const { host, root } = renderPage();

    expect(host.textContent).toContain('Taylor Customer');
    expect(mocks.useCustomer).toHaveBeenCalledWith('42');
    expect(mocks.useCustomerOrders).toHaveBeenCalledWith('42', 1, true);
    expect(mocks.useCustomerAddresses).toHaveBeenCalledWith('42', false);
    expect(mocks.useCustomerLoginAccounts).toHaveBeenCalledWith('42', false);
    expect(host.querySelector('a[href="/orders/100"]')?.textContent).toContain('ORD-100');

    act(() => root.unmount());
    host.remove();
  });

  it('loads page two for customer 42 when Orders Next is clicked', () => {
    resetHooks();
    const { host, root } = renderPage();
    mocks.useCustomerOrders.mockClear();

    const next = Array.from(host.querySelectorAll('button')).find((button) => button.textContent === 'customers.next')!;
    act(() => next.click());

    expect(mocks.useCustomerOrders).toHaveBeenLastCalledWith('42', 2, true);

    act(() => root.unmount());
    host.remove();
  });

  it('enables only the newly selected read-only tab', () => {
    resetHooks();
    const { host, root } = renderPage();
    mocks.useCustomerOrders.mockClear();
    mocks.useCustomerAddresses.mockClear();
    mocks.useCustomerLoginAccounts.mockClear();

    const addressTab = Array.from(host.querySelectorAll('button')).find((button) => button.textContent === 'customers.address_book')!;
    act(() => addressTab.click());
    expect(mocks.useCustomerOrders).toHaveBeenLastCalledWith('42', 1, false);
    expect(mocks.useCustomerAddresses).toHaveBeenLastCalledWith('42', true);
    expect(mocks.useCustomerLoginAccounts).toHaveBeenLastCalledWith('42', false);
    expect(host.textContent).toContain('address@example.com');
    expect(host.textContent).toContain('customers.shipping_default');
    expect(host.textContent).toContain('customers.billing_default');
    expect(host.textContent).toContain('customers.column_joined');
    expect(host.textContent).not.toContain('customers.edit');

    mocks.useCustomerOrders.mockClear();
    mocks.useCustomerAddresses.mockClear();
    mocks.useCustomerLoginAccounts.mockClear();
    const accountsTab = Array.from(host.querySelectorAll('button')).find((button) => button.textContent === 'customers.login_accounts')!;
    act(() => accountsTab.click());
    expect(mocks.useCustomerOrders).toHaveBeenLastCalledWith('42', 1, false);
    expect(mocks.useCustomerAddresses).toHaveBeenLastCalledWith('42', false);
    expect(mocks.useCustomerLoginAccounts).toHaveBeenLastCalledWith('42', true);
    expect(host.textContent).toContain('login@example.com');
    expect(host.textContent).not.toContain('address@example.com');
    const accountRows = Array.from(host.querySelectorAll('section > div > p'));
    expect(accountRows.map((row) => row.textContent)).toEqual(['login@example.com']);
    expect(host.textContent).not.toMatch(/Edit|Reset Password|password/i);
    expect(host.querySelectorAll('input, select, textarea').length).toBe(0);

    act(() => root.unmount());
    host.remove();
  });
});
