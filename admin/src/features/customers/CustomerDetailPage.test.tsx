import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  useCustomer: vi.fn(),
  useCustomerOrders: vi.fn(),
  useCustomerAddresses: vi.fn(),
  useCustomerLoginAccounts: vi.fn(),
  updateCustomer: vi.fn(),
  updateCustomerAddress: vi.fn(),
  deleteCustomerAddress: vi.fn(),
  updateCustomerLoginAccount: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('react-hot-toast', () => ({ default: { success: mocks.toastSuccess, error: mocks.toastError } }));
vi.mock('./api', () => ({
  useCustomer: (...args: unknown[]) => mocks.useCustomer(...args),
  useCustomerOrders: (...args: unknown[]) => mocks.useCustomerOrders(...args),
  useCustomerAddresses: (...args: unknown[]) => mocks.useCustomerAddresses(...args),
  useCustomerLoginAccounts: (...args: unknown[]) => mocks.useCustomerLoginAccounts(...args),
  updateCustomer: (...args: unknown[]) => mocks.updateCustomer(...args),
  updateCustomerAddress: (...args: unknown[]) => mocks.updateCustomerAddress(...args),
  deleteCustomerAddress: (...args: unknown[]) => mocks.deleteCustomerAddress(...args),
  updateCustomerLoginAccount: (...args: unknown[]) => mocks.updateCustomerLoginAccount(...args),
}));

import { CustomerDetailPage } from './CustomerDetailPage';
import type { Customer } from './api';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const customer = { id: 42, name: 'Taylor Customer', first_name: 'Taylor', last_name: 'Customer', company_name: 'Pet Posture', tax_identifier: 'VAT-1', email: 'taylor@example.com', phone: '0123456789', orders_count: 2, orders_sum_total: 12999, created_at: '2026-08-31T10:00:00Z', status: 'active' as const };
const zeroCustomer = { ...customer, orders_count: 0, orders_sum_total: 0 };
const orders = { data: [{ id: '100', reference: 'ORD-100', status: 'shipped', status_label: 'Shipped', total: { formatted: '$129.99', decimal: 129.99, currency: 'USD' }, created_at: '2026-08-31 10:00:00' }], meta: { current_page: 1, last_page: 2, per_page: 15, total: 16 } };
const addresses = [{ id: 1, title: 'Home', first_name: 'Taylor', last_name: 'Customer', line_one: '1 Main Street', line_two: null, line_three: null, city: 'Hanoi', state: null, postcode: '10000', contact_phone: '0123456789', contact_email: 'address@example.com', shipping_default: true, billing_default: true, created_at: '2026-08-31T10:00:00Z' }];
const accounts = [{ id: 7, email: 'login@example.com' }];

function query(data: unknown) { return { isLoading: false, isError: false, data }; }

function renderPage() {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  act(() => root.render(createElement(QueryClientProvider, { client }, createElement(MemoryRouter, { initialEntries: ['/customers/42'] }, createElement(Routes, null, createElement(Route, { path: '/customers/:id', element: createElement(CustomerDetailPage) }))))));
  return { host, root, client };
}

function resetHooks(summary: Customer = customer) {
  mocks.useCustomer.mockReset().mockReturnValue(query(summary));
  mocks.useCustomerOrders.mockReset().mockReturnValue(query(orders));
  mocks.useCustomerAddresses.mockReset().mockReturnValue(query(addresses));
  mocks.useCustomerLoginAccounts.mockReset().mockReturnValue(query(accounts));
  mocks.updateCustomer.mockReset().mockResolvedValue(summary);
  mocks.updateCustomerAddress.mockReset().mockResolvedValue(addresses[0]);
  mocks.deleteCustomerAddress.mockReset().mockResolvedValue(undefined);
  mocks.updateCustomerLoginAccount.mockReset().mockResolvedValue(accounts[0]);
  mocks.toastSuccess.mockReset();
  mocks.toastError.mockReset();
}

function click(host: HTMLElement, label: string) {
  const button = Array.from(host.querySelectorAll('button')).find((element) => element.getAttribute('aria-label') === label || element.textContent === label);
  expect(button).toBeTruthy();
  act(() => button!.click());
}

function setInput(host: HTMLElement, id: string, value: string) {
  const input = host.querySelector<HTMLInputElement>(`#${id}`)!;
  expect(input).toBeTruthy();
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
  act(() => { setter.call(input, value); input.dispatchEvent(new Event('input', { bubbles: true })); });
}

describe('CustomerDetailPage', () => {
  it('shows dollar stat cards, average spend, pill tabs, and accessible order view navigation', () => {
    resetHooks();
    const { host, root } = renderPage();

    expect(host.textContent).toContain('customers.total_orders');
    expect(host.textContent).toContain('2');
    expect(host.textContent).toContain('$65.00');
    expect(host.textContent).toContain('$129.99');
    expect(host.querySelector('[role="tab"]')?.className).toContain('rounded-full');
    expect(host.querySelector('a[aria-label="customers.view_order"][href="/orders/100"]')).toBeTruthy();

    act(() => root.unmount()); host.remove();
  });

  it('shows read-only customer details from actual fields before the tab list', () => {
    resetHooks({ ...customer, name: 'Display fallback', first_name: 'Taylor', last_name: 'Customer' });
    const { host, root } = renderPage();
    const details = Array.from(host.querySelectorAll('section')).find((section) => section.textContent?.includes('customers.customer_details'));
    const tabList = host.querySelector('[role="tablist"]');

    expect(details).toBeTruthy();
    expect(details?.textContent).toContain('customers.full_name');
    expect(details?.textContent).toContain('Taylor Customer');
    expect(details?.textContent).toContain('Pet Posture');
    expect(details?.textContent).toContain('VAT-1');
    expect(details?.textContent).toContain('taylor@example.com');
    expect(details?.textContent).toContain('0123456789');
    expect(Boolean(details && tabList && (details.compareDocumentPosition(tabList) & Node.DOCUMENT_POSITION_FOLLOWING))).toBe(true);

    act(() => root.unmount()); host.remove();
  });

  it('uses dashes for blank customer details and contains the existing tab pills', () => {
    resetHooks({ ...customer, first_name: ' ', last_name: null, company_name: ' ', tax_identifier: null, email: ' ', phone: null });
    const { host, root } = renderPage();
    const details = Array.from(host.querySelectorAll('section')).find((section) => section.textContent?.includes('customers.customer_details'));
    const tabList = host.querySelector<HTMLElement>('[role="tablist"]');

    expect(details).toBeTruthy();
    expect(details?.textContent?.match(/—/g)).toHaveLength(5);
    expect(tabList?.className).toContain('inline-flex gap-1 rounded-full bg-slate-100 p-1');
    expect(host.querySelector('[role="tab"][aria-selected="true"]')?.textContent).toBe('customers.orders');
    click(host, 'customers.address_book');
    expect(host.querySelector('[role="tab"][aria-selected="true"]')?.textContent).toBe('customers.address_book');

    act(() => root.unmount()); host.remove();
  });

  it('submits only owned customer details and leaves contact inputs read-only', async () => {
    resetHooks();
    const { host, root, client } = renderPage();
    const invalidateQueries = vi.spyOn(client, 'invalidateQueries');
    click(host, 'customers.edit');
    expect(host.querySelector<HTMLInputElement>('#customer-email')?.readOnly).toBe(true);
    expect(host.querySelector<HTMLInputElement>('#customer-phone')?.readOnly).toBe(true);
    setInput(host, 'customer-first_name', 'Updated');
    const form = host.querySelector<HTMLFormElement>('[data-customer-details-form]')!;
    await act(async () => { form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); });
    expect(mocks.updateCustomer).toHaveBeenCalledWith('42', { first_name: 'Updated', last_name: 'Customer', company_name: 'Pet Posture', tax_identifier: 'VAT-1' });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['customers', '42'] });
    expect(mocks.toastSuccess).toHaveBeenCalledWith('customers.update_success');
    act(() => root.unmount()); host.remove();
  });

  it('edits an exact address payload and requires confirmation before delete', async () => {
    resetHooks();
    const { host, root } = renderPage();
    click(host, 'customers.address_book');
    click(host, 'customers.edit_address');
    setInput(host, 'address-line_one', '2 New Street');
    const form = host.querySelector<HTMLFormElement>('[data-address-form]')!;
    await act(async () => { form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); });
    expect(mocks.updateCustomerAddress).toHaveBeenCalledWith('42', 1, { title: 'Home', first_name: 'Taylor', last_name: 'Customer', line_one: '2 New Street', line_two: null, line_three: null, city: 'Hanoi', state: null, postcode: '10000', contact_phone: '0123456789', contact_email: 'address@example.com', shipping_default: true, billing_default: true });
    click(host, 'customers.delete_address');
    expect(mocks.deleteCustomerAddress).not.toHaveBeenCalled();
    click(host, 'common.delete');
    await act(async () => {});
    expect(mocks.deleteCustomerAddress).toHaveBeenCalledWith('42', 1);
    act(() => root.unmount()); host.remove();
  });

  it('preserves blank login passwords, sends a supplied password, and blocks mismatch client-side', async () => {
    resetHooks();
    const { host, root } = renderPage();
    click(host, 'customers.login_accounts');
    click(host, 'customers.edit_login_account');
    let form = host.querySelector<HTMLFormElement>('[data-login-account-form]')!;
    await act(async () => { form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); });
    expect(mocks.updateCustomerLoginAccount).toHaveBeenCalledWith('42', 7, { email: 'login@example.com' });
    click(host, 'customers.edit_login_account');
    setInput(host, 'login-password', 'new-password');
    setInput(host, 'login-password_confirmation', 'different');
    form = host.querySelector<HTMLFormElement>('[data-login-account-form]')!;
    act(() => form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
    expect(host.textContent).toContain('customers.password_mismatch');
    expect(mocks.updateCustomerLoginAccount).toHaveBeenCalledTimes(1);
    setInput(host, 'login-password_confirmation', 'new-password');
    await act(async () => { form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); });
    expect(mocks.updateCustomerLoginAccount).toHaveBeenLastCalledWith('42', 7, { email: 'login@example.com', password: 'new-password', password_confirmation: 'new-password' });
    act(() => root.unmount()); host.remove();
  });
});
