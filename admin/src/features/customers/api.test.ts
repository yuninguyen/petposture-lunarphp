import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ fetchJson: vi.fn() }));
vi.mock('@/lib/api', () => ({ fetchJson: mocks.fetchJson }));

import * as customerApi from './api';
import { buildCustomersQuery, fetchCustomer, fetchCustomerAddresses, fetchCustomerLoginAccounts, fetchCustomerOrders, fetchCustomers, type CustomerAddress } from './api';

describe('customers api', () => {
  it('serializes trimmed optional list filters exactly', () => {
    expect(buildCustomersQuery({})).toBe('/admin/customers');
    expect(buildCustomersQuery({ search: '  Taylor Customer  ', status: 'inactive', page: 2 }))
      .toBe('/admin/customers?search=Taylor+Customer&status=inactive&page=2');
  });

  it('requests the list endpoint with its serialized filters', async () => {
    const page = { data: [], meta: { current_page: 1, last_page: 1, per_page: 15, total: 0 } };
    mocks.fetchJson.mockResolvedValueOnce(page);

    await expect(fetchCustomers({ search: 'Taylor', status: 'active', page: 3 })).resolves.toEqual(page);
    expect(mocks.fetchJson).toHaveBeenCalledWith('/admin/customers?search=Taylor&status=active&page=3');
  });

  it('requests only Task 2 read endpoints for customer detail data', async () => {
    mocks.fetchJson.mockReset();
    const summary = { id: 42, name: 'Taylor', email: null, orders_count: 0, orders_sum_total: null, created_at: null, status: 'active' as const };
    const orders = { data: [], meta: { current_page: 2, last_page: 2, per_page: 15, total: 16 } };
    const addresses: CustomerAddress[] = [];
    const accounts = [{ id: 7, email: 'login@example.com' }];
    mocks.fetchJson.mockResolvedValueOnce({ data: summary }).mockResolvedValueOnce(orders).mockResolvedValueOnce({ data: addresses }).mockResolvedValueOnce({ data: accounts });

    await expect(fetchCustomer('42')).resolves.toEqual(summary);
    await expect(fetchCustomerOrders('42', 2)).resolves.toEqual(orders);
    await expect(fetchCustomerAddresses('42')).resolves.toEqual(addresses);
    await expect(fetchCustomerLoginAccounts('42')).resolves.toEqual(accounts);
    expect(mocks.fetchJson).toHaveBeenNthCalledWith(1, '/admin/customers/42');
    expect(mocks.fetchJson).toHaveBeenNthCalledWith(2, '/admin/customers/42/orders?page=2');
    expect(mocks.fetchJson).toHaveBeenNthCalledWith(3, '/admin/customers/42/addresses');
    expect(mocks.fetchJson).toHaveBeenNthCalledWith(4, '/admin/customers/42/login-accounts');
    expect(mocks.fetchJson.mock.calls).toHaveLength(4);
    for (const call of mocks.fetchJson.mock.calls) expect(call).toHaveLength(1);
  });

  it('sends only owned profile fields when updating a customer', async () => {
    mocks.fetchJson.mockReset().mockResolvedValueOnce({ data: { id: 42 } });
    const updateCustomer = (customerApi as Record<string, unknown>).updateCustomer as (id: string, payload: unknown) => Promise<unknown>;

    await updateCustomer('42', { first_name: 'Taylor', last_name: 'Customer', company_name: 'Pet Posture', tax_identifier: 'VAT-1' });

    expect(mocks.fetchJson).toHaveBeenCalledWith('/admin/customers/42', {
      method: 'PUT',
      body: { first_name: 'Taylor', last_name: 'Customer', company_name: 'Pet Posture', tax_identifier: 'VAT-1' },
    });
  });

  it('uses the exact address and login-account mutation contracts', async () => {
    mocks.fetchJson.mockReset().mockResolvedValue({ data: { id: 1 } });
    const updateAddress = (customerApi as Record<string, unknown>).updateCustomerAddress as (customerId: string, addressId: number, payload: unknown) => Promise<unknown>;
    const deleteAddress = (customerApi as Record<string, unknown>).deleteCustomerAddress as (customerId: string, addressId: number) => Promise<unknown>;
    const updateAccount = (customerApi as Record<string, unknown>).updateCustomerLoginAccount as (customerId: string, userId: number, payload: unknown) => Promise<unknown>;
    const address = { title: 'Home', first_name: 'Taylor', last_name: 'Customer', line_one: '1 Main Street', line_two: null, line_three: null, city: 'Hanoi', state: null, postcode: '10000', contact_phone: '0123456789', contact_email: 'address@example.com', shipping_default: true, billing_default: false };

    await updateAddress('42', 1, address);
    await deleteAddress('42', 1);
    await updateAccount('42', 7, { email: 'new@example.com', password: 'new-password', password_confirmation: 'new-password' });

    expect(mocks.fetchJson).toHaveBeenNthCalledWith(1, '/admin/customers/42/addresses/1', { method: 'PUT', body: address });
    expect(mocks.fetchJson).toHaveBeenNthCalledWith(2, '/admin/customers/42/addresses/1', { method: 'DELETE' });
    expect(mocks.fetchJson).toHaveBeenNthCalledWith(3, '/admin/customers/42/login-accounts/7', { method: 'PUT', body: { email: 'new@example.com', password: 'new-password', password_confirmation: 'new-password' } });
  });
});
